import { CheckIcon, CopyIcon } from 'lucide-react'
import { useState } from 'react'
import { leaveRoom, loadRoom, newRoomSecret, onPublicRoom, roomLink, saveRoom } from '@/data/room'
import { setState, toast, useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog'

export const openSync = () => setState({ syncOpen: true })

export function SyncDialog() {
  const open = useStore((s) => s.syncOpen)
  return (
    <Dialog open={open} onOpenChange={(o) => setState({ syncOpen: o })}>
      <DialogPopup className="sm:max-w-md" aria-label="Share this board">{open ? <SyncBody /> : null}</DialogPopup>
    </Dialog>
  )
}

function SyncBody() {
  const mode = useStore((s) => s.mode)
  const via = useStore((s) => s.via)
  const conn = useStore((s) => s.conn)
  if (mode === 'cloud' && via === null) {
    return (
      <>
        <DialogHeader><DialogTitle>Synced</DialogTitle><DialogDescription>This copy runs inside Claude, which keeps everyone’s tasks in sync by itself.</DialogDescription></DialogHeader>
        <DialogFooter><DialogClose render={<Button />}>Done</DialogClose></DialogFooter>
      </>
    )
  }
  return via === 'room' ? <Shared conn={conn} /> : <Start />
}

function Start() {
  const start = () => { saveRoom(newRoomSecret()); location.reload() }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Share this board</DialogTitle>
        <DialogDescription>Right now your tasks live only in this browser. One tap turns on sharing: you get a link, anyone who opens it sees and edits the same board, live. Nothing to sign up for.</DialogDescription>
      </DialogHeader>
      <DialogPanel><p className="text-sm text-muted-foreground">Everything is encrypted before it leaves your device. The link is the key, so only send it to the people who should have the board.</p></DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" />}>Not now</DialogClose>
        <Button onClick={start}>Start sharing</Button>
      </DialogFooter>
    </>
  )
}

function Shared({ conn }: { conn: string }) {
  const [copied, setCopied] = useState(false)
  const secret = loadRoom()
  const shared = onPublicRoom()
  const status = conn === 'live' ? 'Live. Changes show up on every device within a moment.' : conn === 'slow' ? 'Can’t reach the network right now. Your changes are kept here and will go out when it is back.' : 'Connecting…'
  const copy = () => {
    navigator.clipboard?.writeText(secret ? roomLink(secret) : location.origin + location.pathname).then(() => { setCopied(true); toast('Link copied'); setTimeout(() => setCopied(false), 2000) }, () => toast('Could not copy'))
  }
  return (
    <>
      <DialogHeader><DialogTitle>Board is shared</DialogTitle><DialogDescription>{status}</DialogDescription></DialogHeader>
      <DialogPanel>
        <p className="text-sm text-muted-foreground">{shared ? 'Everyone who opens this site’s link is on the same board, live. Nothing to set up.' : 'Send this link to your phone and to Barbora and Rokas. Opening it once is enough: that device stays on the board.'}</p>
        <Button variant="secondary" className="mt-3 w-full" onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}{copied ? 'Copied' : 'Copy link'}</Button>
        <p className="mt-3 text-xs text-muted-foreground">Anyone with the link can edit.</p>
      </DialogPanel>
      <DialogFooter>
        {shared ? null : <Button variant="ghost" className="mr-auto text-destructive-foreground" onClick={() => { leaveRoom(); location.reload() }}>Stop sharing on this device</Button>}
        <DialogClose render={<Button />}>Done</DialogClose>
      </DialogFooter>
    </>
  )
}
