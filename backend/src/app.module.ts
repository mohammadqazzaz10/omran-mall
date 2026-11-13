import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BreaksGateway } from './modules/breaks/breaks.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [],
  providers: [BreaksGateway],
})
export class AppModule {}
