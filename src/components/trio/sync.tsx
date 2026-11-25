import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react'
import { useState } from 'react'
import { clearGithubConfig, githubRepo, joinLink, loadGithubConfig, saveGithubConfig, verifyGithub } from '@/data/github'
import { setState, toast, useStore } from '@/data/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export const openSync = () => setState({ syncOpen: true })

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'
const NEW_REPO_URL = 'https://github.com/new?name=trio-data&visibility=private&description=Trio%20board%20data'

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-foreground/10 text-xs font-medium text-foreground">{n}</span>
    <span className="min-w-0">{children}</span>
  </li>
)

export function SyncDialog() {
  const open = useStore((s) => s.syncOpen)
  return (
    <Dialog open={open} onOpenChange={(o) => setState({ syncOpen: o })}>
      <DialogPopup className="sm:max-w-md" aria-label="Sync across devices">{open ? <SyncBody /> : null}</DialogPopup>
    </Dialog>
  )
}

function SyncBody() {
  const mode = useStore((s) => s.mode)
  const via = useStore((s) => s.via)
  const conn = useStore((s) => s.conn)
  const close = () => setState({ syncOpen: false })

  if (mode === 'cloud' && via === null) {
    return (
      <>
        <DialogHeader><DialogTitle>Synced</DialogTitle><DialogDescription>This copy runs inside Claude, which keeps everyone’s tasks in sync by itself. Nothing to set up.</DialogDescription></DialogHeader>
        <DialogFooter><DialogClose render={<Button />}>Done</DialogClose></DialogFooter>
      </>
    )
  }
  return via === 'github' ? <Connected conn={conn} close={close} /> : <Connect />
}

function Connected({ conn, close }: { conn: string; close: () => void }) {
  const repo = githubRepo()
  const [copied, setCopied] = useState(false)
  const status = conn === 'live' ? 'Synced. Changes show up on every device within a few seconds.' : conn === 'error' ? 'Can’t sync: GitHub refused the token or the repository. Disconnect and connect again.' : conn === 'slow' ? 'Can’t reach GitHub right now. Your changes are kept here and will upload when it is back.' : 'Connecting…'
  const copy = () => {
    const c = loadGithubConfig()
    if (!c) return
    navigator.clipboard?.writeText(joinLink(c)).then(() => { setCopied(true); toast('Join link copied'); setTimeout(() => setCopied(false), 2000) }, () => toast('Could not copy'))
  }
  return (
    <>
      <DialogHeader><DialogTitle>Sync across devices</DialogTitle><DialogDescription>Connected to <b className="font-medium text-foreground">{repo}</b></DialogDescription></DialogHeader>
      <DialogPanel>
        <p className="text-sm text-muted-foreground">{status}</p>
        <p className="mt-4 text-sm text-muted-foreground">To add your phone or a teammate, send them the join link. It contains the access token, so send it privately (not in a public place).</p>
        <Button variant="secondary" className="mt-3 w-full" onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}{copied ? 'Copied' : 'Copy join link'}</Button>
      </DialogPanel>
      <DialogFooter>
        <Button variant="ghost" className="mr-auto text-destructive-foreground" onClick={() => { clearGithubConfig(); location.reload() }}>Disconnect</Button>
        <Button onClick={close}>Done</Button>
      </DialogFooter>
    </>
  )
}

function Connect() {
  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const submit = async () => {
    setBusy(true); setErr(null)
    const cfg = { repo: repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, ''), token: token.trim() }
    const problem = await verifyGithub(cfg)
    if (problem) { setErr(problem); setBusy(false); return }
    saveGithubConfig(cfg)
    location.reload()
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex min-h-0 flex-1 flex-col">
      <DialogHeader>
        <DialogTitle>Sync across devices</DialogTitle>
        <DialogDescription>Right now this board lives only in this browser. To share it, keep it in a private GitHub repo. No server, and nothing secret goes in the website’s code.</DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <ol className="flex flex-col gap-3">
          <Step n={1}><a className="inline-flex items-center gap-1 text-foreground underline underline-offset-4" href={NEW_REPO_URL} target="_blank" rel="noreferrer">Create a private repo<ExternalLinkIcon className="size-3.5" /></a> (any name, for example trio-data).</Step>
          <Step n={2}><a className="inline-flex items-center gap-1 text-foreground underline underline-offset-4" href={TOKEN_URL} target="_blank" rel="noreferrer">Create a fine-grained token<ExternalLinkIcon className="size-3.5" /></a> for only that repo, with <b className="font-medium text-foreground">Contents: Read and write</b>.</Step>
          <Step n={3}>Paste them here. Then use <b className="font-medium text-foreground">Copy join link</b> to put your phone and the others on the same board.</Step>
        </ol>
        <label htmlFor="gh-repo" className="mt-5 mb-1.5 block text-sm text-muted-foreground">Repository</label>
        <Input id="gh-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="your-name/trio-data" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} size="lg" />
        <label htmlFor="gh-token" className="mt-4 mb-1.5 block text-sm text-muted-foreground">Token</label>
        <Input id="gh-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} size="lg" />
        {err ? <p role="alert" className="mt-3 text-sm text-destructive-foreground">{err}</p> : null}
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="ghost" />}>Not now</DialogClose>
        <Button type="submit" disabled={busy || !repo.trim() || !token.trim()}>{busy ? 'Checking…' : 'Connect'}</Button>
      </DialogFooter>
    </form>
  )
}
