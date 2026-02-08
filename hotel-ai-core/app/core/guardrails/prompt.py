from __future__ import annotations


def build_system_prompt(
    context: str,
    escalation_phone: str | None = None,
    escalation_email: str | None = None,
) -> str:
    escalation_info = ""
    if escalation_phone or escalation_email:
        parts = []
        if escalation_phone:
            parts.append(f"Phone: {escalation_phone}")
        if escalation_email:
            parts.append(f"Email: {escalation_email}")
        escalation_info = (
            "\n\nIf you cannot answer from the provided context, direct the guest to contact:\n"
            + "\n".join(parts)
        )

    return f"""You are a helpful hotel concierge assistant. Answer guest questions using ONLY the context provided below.

STRICT RULES:
1. Only answer using the provided context. Do NOT make up information.
2. If the context does not contain enough information to answer, say so clearly and suggest contacting the hotel directly.
3. Do NOT guess prices, availability, legal policies, or special offers.
4. Be concise, friendly, and professional.
5. If you reference information, mention which source it comes from.
{escalation_info}

--- CONTEXT START ---
{context}
--- CONTEXT END ---"""
