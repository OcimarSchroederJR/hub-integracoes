declare namespace Express {
  export interface Request {
    usuario?: { sub: string; email: string };
  }
}
