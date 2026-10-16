export const APP_LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.x-bootstrap-secret',
  'password',
  'secret',
  'token',
  '*.password',
  '*.secret',
  '*.token',
];
