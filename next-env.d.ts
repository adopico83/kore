/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/dev/types/routes.d.ts";

declare namespace NodeJS {
  interface ProcessEnv {
    SUPABASE_SERVICE_ROLE_KEY: string;
  }
}

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
