# Password Reset Cooldown: Backend Requirements

## Current API behavior

`POST /api/auth/forgot-password` validates the email, requests a reset email, and returns HTTP 200 with a generic message: "If an account exists for this email, password reset instructions will be sent." The response does not say whether an account exists and does not include cooldown or retry information.

The forgot-password and reset-password routes share an in-memory rate limiter: five requests per minute per client IP. When the limit is exceeded, the API returns HTTP 429 and sets a `Retry-After` header in seconds. The current frontend API service uses the error response but does not expose that header to the view. Because the limiter is in memory, its state is not shared across backend instances and is lost on a process restart.

## Missing capability and recommendation

The backend does not provide a successful-request cooldown per email or persist that cooldown across page refreshes, devices, or backend instances. The frontend's 30-second resend countdown is therefore only a user-experience guard for the current page; it is not security enforcement. A user can bypass it by refreshing, using another browser or device, or calling the endpoint directly. The existing per-IP limiter offers server-side protection, but it does not implement the same per-email cooldown.

If a consistent cooldown is required, add server-side enforcement for password-reset requests, backed by shared persistent storage when multiple backend instances are used. Keep the response generic to avoid account enumeration, and return a documented `Retry-After` value or equivalent cooldown metadata so clients can display the server's actual remaining wait. Apply the same server-side policy regardless of client behavior.

No backend file was changed for the frontend cooldown implementation.
