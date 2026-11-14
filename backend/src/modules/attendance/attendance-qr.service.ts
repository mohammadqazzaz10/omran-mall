import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { DatabaseService } from "../../database/database.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { AttendanceQrCheckInDto } from "./attendance.dto";
import { AttendanceService } from "./attendance.service";

type QrPayload = { v: 1; b: string; n: string; e: number };

@Injectable()
export class AttendanceQrService {
  constructor(
    private readonly db: DatabaseService,
    private readonly attendance: AttendanceService,
  ) {}

  private signingKey(branchSalt: string): Buffer {
    const secret = process.env.ATTENDANCE_QR_SECRET;
    if (!branchSalt) {
      throw new ServiceUnavailableException(
        "ملح توقيع QR غير مضبوط لهذا الفرع",
      );
    }
    if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
      throw new ServiceUnavailableException(
        "خدمة QR غير مهيأة؛ يلزم ضبط ATTENDANCE_QR_SECRET بطول 32 بايت على الأقل",
      );
    }
    return createHmac("sha256", secret).update(branchSalt).digest();
  }

  private distanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = radians(lat2 - lat1);
    const dLon = radians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(radians(lat1)) *
        Math.cos(radians(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async assertDirectCheckInAllowed(
    branchId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const result = await this.db.query<{
      latitude: string | null;
      longitude: string | null;
    }>(
      `SELECT latitude::text, longitude::text
       FROM branches
       WHERE id = $1 AND company_id = $2
         AND is_active = TRUE AND deleted_at IS NULL`,
      [branchId, user.companyId],
    );
    if (!result.rowCount) {
      throw new NotFoundException("الفرع غير موجود أو غير فعال");
    }
    const hasLatitude = result.rows[0].latitude !== null;
    const hasLongitude = result.rows[0].longitude !== null;
    if (hasLatitude !== hasLongitude) {
      throw new ServiceUnavailableException(
        "إعدادات النطاق الجغرافي للفرع غير مكتملة",
      );
    }
    if (hasLatitude && hasLongitude) {
      throw new ForbiddenException(
        "هذا الفرع يتطلب تسجيل الحضور عبر QR مع التحقق من الموقع",
      );
    }
  }

  async geofenceStatus(branchId: string, user: AuthenticatedUser) {
    const result = await this.db.query<{
      latitude: string | null;
      longitude: string | null;
      geofence_radius_meters: number | null;
    }>(
      `SELECT latitude::text, longitude::text, geofence_radius_meters
       FROM branches
       WHERE id = $1 AND company_id = $2
         AND is_active = TRUE AND deleted_at IS NULL`,
      [branchId, user.companyId],
    );
    if (!result.rowCount) {
      throw new NotFoundException("الفرع غير موجود أو غير فعال");
    }
    const {
      latitude,
      longitude,
      geofence_radius_meters: radius,
    } = result.rows[0];
    if ((latitude === null) !== (longitude === null)) {
      throw new ServiceUnavailableException(
        "إعدادات النطاق الجغرافي للفرع غير مكتملة",
      );
    }
    const enabled = latitude !== null && longitude !== null;
    if (
      enabled &&
      radius !== null &&
      (!Number.isInteger(radius) || radius < 25 || radius > 1000)
    ) {
      throw new ServiceUnavailableException(
        "نصف قطر النطاق الجغرافي للفرع خارج الحدود المسموحة",
      );
    }
    return { enabled, radiusMeters: enabled ? (radius ?? 150) : null };
  }

  async createChallenge(branchId: string, user: AuthenticatedUser) {
    const branch = await this.db.query<{
      id: string;
      qr_secret_salt: string;
      expires_epoch: string;
    }>(
      `SELECT id, qr_secret_salt,
              EXTRACT(EPOCH FROM CURRENT_TIMESTAMP + INTERVAL '45 seconds')::bigint::text AS expires_epoch
       FROM branches
       WHERE id = $1 AND company_id = $2
         AND is_active = TRUE AND deleted_at IS NULL`,
      [branchId, user.companyId],
    );
    if (!branch.rowCount) {
      throw new NotFoundException("الفرع غير موجود أو غير فعال");
    }

    const nonce = randomBytes(32).toString("hex");
    const expiresAt = Number(branch.rows[0].expires_epoch);
    const payload: QrPayload = {
      v: 1,
      b: branchId,
      n: nonce,
      e: expiresAt,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac(
      "sha256",
      this.signingKey(branch.rows[0].qr_secret_salt),
    )
      .update(encoded)
      .digest("base64url");
    const token = `${encoded}.${signature}`;
    const nonceHash = createHash("sha256").update(nonce).digest("hex");

    await this.db.query(
      `INSERT INTO attendance_qr_challenges
       (branch_id, nonce_hash, expires_at, created_by_user_id)
       VALUES ($1, $2, TO_TIMESTAMP($3), $4)`,
      [branchId, nonceHash, expiresAt, user.id],
    );

    return {
      token,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
      expiresInSeconds: 45,
      branchId,
    };
  }

  async checkInWithQr(
    branchId: string,
    dto: AttendanceQrCheckInDto,
    user: AuthenticatedUser,
  ) {
    const parts = dto.qrToken.split(".");
    if (parts.length !== 2) {
      throw new ForbiddenException("رمز QR غير صالح");
    }

    let payload: QrPayload;
    try {
      payload = JSON.parse(
        Buffer.from(parts[0], "base64url").toString("utf8"),
      ) as QrPayload;
    } catch {
      throw new ForbiddenException("رمز QR غير صالح");
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      payload.v !== 1 ||
      payload.b !== branchId ||
      typeof payload.n !== "string" ||
      !/^[a-f0-9]{64}$/.test(payload.n) ||
      !Number.isInteger(payload.e) ||
      payload.e <= Math.floor(Date.now() / 1000)
    ) {
      throw new ForbiddenException("رمز QR منتهي الصلاحية أو لا يخص هذا الفرع");
    }

    const branch = await this.db.query<{
      id: string;
      qr_secret_salt: string;
      latitude: string | null;
      longitude: string | null;
      geofence_radius_meters: number | null;
    }>(
      `SELECT id, qr_secret_salt, latitude::text, longitude::text,
              geofence_radius_meters
       FROM branches
       WHERE id = $1 AND company_id = $2
         AND is_active = TRUE AND deleted_at IS NULL`,
      [branchId, user.companyId],
    );
    if (!branch.rowCount) {
      throw new NotFoundException("الفرع غير موجود أو غير فعال");
    }

    const expected = createHmac(
      "sha256",
      this.signingKey(branch.rows[0].qr_secret_salt),
    )
      .update(parts[0])
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(parts[1], "base64url");
    } catch {
      throw new ForbiddenException("توقيع رمز QR غير صالح");
    }
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      throw new ForbiddenException("توقيع رمز QR غير صالح");
    }

    const employee = await this.db.query<{ id: string }>(
      `SELECT id FROM employees
       WHERE user_id = $1 AND branch_id = $2
         AND deleted_at IS NULL AND status = 'active'`,
      [user.id, branchId],
    );
    if (!employee.rowCount) {
      throw new ForbiddenException("لا يوجد ملف موظف فعال مرتبط بهذا الفرع");
    }

    const fence = branch.rows[0];
    let latitude: number | null = null;
    let longitude: number | null = null;
    const geofenceConfigured =
      fence.latitude !== null || fence.longitude !== null;

    if (geofenceConfigured) {
      if (fence.latitude === null || fence.longitude === null) {
        throw new ServiceUnavailableException(
          "إعدادات النطاق الجغرافي للفرع غير مكتملة",
        );
      }
      if (
        dto.latitude === undefined ||
        dto.longitude === undefined ||
        dto.accuracyMeters === undefined
      ) {
        throw new ForbiddenException("يلزم إرسال الموقع للتحقق من نطاق الفرع");
      }
      if (
        dto.accuracyMeters < 0 ||
        dto.accuracyMeters > 100 ||
        !Number.isFinite(dto.latitude) ||
        !Number.isFinite(dto.longitude)
      ) {
        throw new ForbiddenException("دقة الموقع غير كافية للتحقق من الحضور");
      }

      const radius = fence.geofence_radius_meters ?? 150;
      if (!Number.isInteger(radius) || radius < 25 || radius > 1000) {
        throw new ServiceUnavailableException(
          "نصف قطر النطاق الجغرافي للفرع خارج الحدود المسموحة",
        );
      }
      latitude = dto.latitude;
      longitude = dto.longitude;
      const distance = this.distanceMeters(
        Number(fence.latitude),
        Number(fence.longitude),
        latitude,
        longitude,
      );
      if (distance > radius) {
        throw new ForbiddenException("أنت خارج النطاق الجغرافي المسموح للفرع");
      }
    }

    const nonceHash = createHash("sha256").update(payload.n).digest("hex");
    // AttendanceService owns the transaction so challenge use, attendance,
    // location metadata, and audit history either all commit or all roll back.
    return this.attendance.checkInWithQr(
      branchId,
      user,
      nonceHash,
      latitude,
      longitude,
    );
  }
}
