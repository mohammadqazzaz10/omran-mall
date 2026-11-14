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
import { AttendanceService } from "./attendance.service";
import { AttendanceQrCheckInDto } from "./attendance.dto";

type QrPayload = { v: 1; b: string; n: string; e: number };

@Injectable()
export class AttendanceQrService {
  constructor(
    private readonly db: DatabaseService,
    private readonly attendance: AttendanceService,
  ) {}

  private signingKey(branchSalt: string): Buffer {
    const secret = process.env.ATTENDANCE_QR_SECRET;
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
       WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL`,
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

  async createChallenge(branchId: string, user: AuthenticatedUser) {
    const branch = await this.db.query<{
      id: string;
      qr_secret_salt: string;
      expires_epoch: string;
    }>(
      `SELECT id, qr_secret_salt,
              EXTRACT(EPOCH FROM CURRENT_TIMESTAMP + INTERVAL '45 seconds')::bigint::text AS expires_epoch
       FROM branches
       WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL`,
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
       WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL`,
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
       WHERE user_id = $1 AND branch_id = $2 AND deleted_at IS NULL AND status = 'active'`,
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
      latitude = dto.latitude;
      longitude = dto.longitude;
      const distance = this.distanceMeters(
        Number(fence.latitude),
        Number(fence.longitude),
        latitude,
        longitude,
      );
      if (distance > (fence.geofence_radius_meters ?? 150)) {
        throw new ForbiddenException("أنت خارج النطاق الجغرافي المسموح للفرع");
      }
    }

    const nonceHash = createHash("sha256").update(payload.n).digest("hex");
    await this.db.transaction(async (client) => {
      const challenge = await client.query<{ id: string }>(
        `SELECT id FROM attendance_qr_challenges
         WHERE branch_id = $1 AND nonce_hash = $2
           AND expires_at > CURRENT_TIMESTAMP AND revoked_at IS NULL
         FOR UPDATE`,
        [branchId, nonceHash],
      );
      if (!challenge.rowCount) {
        throw new ForbiddenException("رمز QR غير موجود أو انتهت صلاحيته");
      }
      try {
        await client.query(
          `INSERT INTO attendance_qr_uses (challenge_id, employee_id)
           VALUES ($1, $2)`,
          [challenge.rows[0].id, employee.rows[0].id],
        );
      } catch (error) {
        if ((error as { code?: string })?.code === "23505") {
          throw new ConflictException("تم استخدام رمز QR هذا لتسجيل حضورك مسبقاً");
        }
        throw error;
      }
    });

    const record = await this.attendance.checkIn(branchId, user);
    await this.db.transaction(async (client) => {
      const updated = await client.query(
        `UPDATE attendance_records
         SET check_in_method = 'qr_code', check_in_lat = $2, check_in_lng = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND branch_id = $4
         RETURNING id, check_in_method, check_in_lat, check_in_lng`,
        [record.id, latitude, longitude, branchId],
      );
      await client.query(
        `INSERT INTO audit_logs
         (user_id, branch_id, table_name, record_id, action, old_values, new_values)
         VALUES ($1, $2, 'attendance_records', $3, 'UPDATE', $4::jsonb, $5::jsonb)`,
        [
          user.id,
          branchId,
          record.id,
          JSON.stringify({ check_in_method: 'mobile_app' }),
          JSON.stringify(updated.rows[0]),
        ],
      );
    });

    return {
      ...record,
      check_in_method: "qr_code",
      check_in_lat: latitude,
      check_in_lng: longitude,
    };
  }
}
