import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import EmailDialog from '../EmailDialog/EmailDialog'
import styles from './LoginButton.module.css'

export default function LoginButton() {
  const { email } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <>
      {email ? null : (
        <button className={styles.btn} onClick={() => setOpen(true)} title="Sign in" aria-label="Sign in">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>login</span>
        </button>
      )}
      {open && (
        <EmailDialog
          heading="identify yourself"
          sub="enter your email so we know who you are across sessions"
          successMsg="you're logged in"
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}
