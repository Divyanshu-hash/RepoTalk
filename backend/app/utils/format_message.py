def format_user_message(data: dict[str, str | None]) -> str:
    parts: list[str] = []
    for key, value in data.items():
        if isinstance(value, str):
            parts.append(f"<{key}>\n{value}\n</{key}>")
    return "\n".join(parts)