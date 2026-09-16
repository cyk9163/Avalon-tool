declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    HOST_KEY_HASHES?: string;
    BUCKET?: R2Bucket;
  }
}
