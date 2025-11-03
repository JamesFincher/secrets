'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useToast } from '@/lib/use-toast'

interface MasterPasswordPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Master Password Prompt Component
 *
 * Prompts the user to enter their master password to unlock the vault.
 * This component is shown when:
 * - User's master password session has expired (KEK salt no longer in memory)
 * - User needs to decrypt secrets but hasn't verified their master password yet
 *
 * Upon successful verification:
 * - Master password is cached in memory (auth store)
 * - KEK salt is cached in memory for envelope encryption
 * - Vault is considered "unlocked" for the session
 */
export function MasterPasswordPrompt({
  open,
  onOpenChange,
  onSuccess,
}: MasterPasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { verifyMasterPassword } = useAuthStore()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password) {
      toast({
        title: 'Error',
        description: 'Please enter your master password',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)

    try {
      const isValid = await verifyMasterPassword(password)

      if (isValid) {
        toast({
          title: 'Success',
          description: 'Vault unlocked successfully',
        })
        setPassword('')
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast({
          title: 'Error',
          description: 'Invalid master password',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to verify master password',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setPassword('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Unlock Your Vault</DialogTitle>
          <DialogDescription>
            Enter your master password to unlock your vault and access your secrets.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="password">Master Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your master password"
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold mb-1">🔒 Zero-Knowledge Security</p>
              <p className="text-muted-foreground text-xs">
                Your master password is never sent to our servers.
                It's used locally to decrypt your secrets on your device.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Unlocking...' : 'Unlock Vault'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
