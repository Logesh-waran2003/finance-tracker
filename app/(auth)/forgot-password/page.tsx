'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password?</CardTitle>
        <CardDescription>Contact your administrator to reset your password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Password resets are handled by your system administrator.
          Please reach out to them directly with your email address and they will reset it for you.
        </p>
        <Link href="/login" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </CardContent>
    </Card>
  )
}
