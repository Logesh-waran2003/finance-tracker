import { ChangePasswordForm } from '@/components/change-password-form'

/**
 * Change password outside the app shell. It renders the same form the profile
 * screen uses — one implementation, so the validation and the error copy can
 * never drift apart between the two entry points.
 */
export default function ResetPasswordPage() {
  return <ChangePasswordForm />
}
