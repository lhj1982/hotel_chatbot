import type { Escalation } from "../lib/types";

interface Props {
  escalation: Escalation;
}

export function EscalationCard({ escalation }: Props) {
  return (
    <div class="hcw-escalation">
      <p class="hcw-escalation__message">{escalation.message}</p>
      <div class="hcw-escalation__actions">
        {escalation.phone && (
          <a href={`tel:${escalation.phone}`} class="hcw-escalation__btn">
            <PhoneIcon />
            {escalation.phone}
          </a>
        )}
        {escalation.email && (
          <a href={`mailto:${escalation.email}`} class="hcw-escalation__btn">
            <EmailIcon />
            {escalation.email}
          </a>
        )}
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
