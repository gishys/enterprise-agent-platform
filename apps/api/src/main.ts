import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./modules/app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true
  });
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  const configService = app.get(ConfigService);
  const port = configService.get<number>("app.port") ?? 3000;
  await app.listen(port);
}

void bootstrap();
