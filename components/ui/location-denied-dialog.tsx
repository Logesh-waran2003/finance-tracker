'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin } from 'lucide-react'

function detectBrowser(): 'chrome-android' | 'safari-ios' | 'chrome-desktop' | 'firefox' | 'safari-mac' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua)
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua)
  const isFirefox = /Firefox/i.test(ua)

  if (isAndroid && isChrome) return 'chrome-android'
  if (isIOS && isSafari) return 'safari-ios'
  if (isIOS) return 'safari-ios'
  if (isChrome) return 'chrome-desktop'
  if (isFirefox) return 'firefox'
  if (isSafari) return 'safari-mac'
  return 'other'
}

const INSTRUCTIONS: Record<ReturnType<typeof detectBrowser>, { title: string; steps: string[] }> = {
  'chrome-android': {
    title: 'Enable Location on Chrome (Android)',
    steps: [
      'Tap the lock icon 🔒 in the address bar',
      'Tap "Permissions"',
      'Tap "Location" and set to "Allow"',
      'Refresh this page and try again',
    ],
  },
  'safari-ios': {
    title: 'Enable Location on Safari (iPhone / iPad)',
    steps: [
      'Open Settings on your device',
      'Scroll down and tap "Safari"',
      'Tap "Location"',
      'Select "Ask" or "Allow"',
      'Come back to this page and try again',
    ],
  },
  'chrome-desktop': {
    title: 'Enable Location on Chrome',
    steps: [
      'Click the lock icon 🔒 in the address bar',
      'Click "Site settings"',
      'Find "Location" and change it to "Allow"',
      'Refresh the page and try again',
    ],
  },
  'firefox': {
    title: 'Enable Location on Firefox',
    steps: [
      'Click the lock icon 🔒 in the address bar',
      'Click the X next to "Blocked temporarily" under Location',
      'Refresh the page — Firefox will ask again',
      'Click "Allow Location Access"',
    ],
  },
  'safari-mac': {
    title: 'Enable Location on Safari (Mac)',
    steps: [
      'In the menu bar, go to Safari → Settings → Websites',
      'Click "Location" in the sidebar',
      'Find this website and set it to "Allow"',
      'Refresh the page and try again',
    ],
  },
  'other': {
    title: 'Enable Location Access',
    steps: [
      'Look for a lock icon 🔒 or info icon in the address bar',
      'Find "Location" or "Permissions" in the menu that appears',
      'Change Location to "Allow"',
      'Refresh the page and try again',
    ],
  },
}

interface Props {
  open: boolean
  onClose: () => void
}

export function LocationDeniedDialog({ open, onClose }: Props) {
  const browser = detectBrowser()
  const info = INSTRUCTIONS[browser]

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl">
        <DialogTitle className="flex items-center gap-2 font-semibold">
          <MapPin size={16} className="text-red-500" />
          {info.title}
        </DialogTitle>
        <p className="text-sm text-gray-500">Location access is blocked. Follow these steps to enable it:</p>
        <ol className="space-y-2 mt-1">
          {info.steps.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="font-bold text-blue-600 shrink-0">{i + 1}.</span>
              <span className="text-gray-700">{step}</span>
            </li>
          ))}
        </ol>
        <Button className="w-full mt-2" onClick={onClose}>Got it</Button>
      </DialogContent>
    </Dialog>
  )
}
