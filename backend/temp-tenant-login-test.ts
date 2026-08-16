import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/app.module";
import { TenantAuthService } from "./src/modules/tenant-auth/tenant-auth.service";
async function main(){
  const app = await NestFactory.createApplicationContext(AppModule);
  const auth = app.get(TenantAuthService);
  try {
    const fakeRes = {
      cookie: (name: string, value: string, opts: any) => {
        console.log('cookie set', name, opts.maxAge, opts.sameSite, opts.httpOnly, opts.secure);
      },
      clearCookie: (name: string) => {
        console.log('clear cookie', name);
      },
    };
    const result = await auth.login('test1','jamal@test1.com','Asd123@@', fakeRes as any);
    console.log('RESULT', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('ERROR', e);
  } finally {
    await app.close();
  }
}
main();
