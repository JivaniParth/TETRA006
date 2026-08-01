import re

def parse_markdown_to_html(text: str) -> str:
    """
    Parses basic Markdown (Headers, Bold, Italics, Lists, Linebreaks)
    into clean, safe HTML without external dependencies.
    """
    if not text:
        return ""
        
    # 1. Escape HTML special characters for safety (prevent XSS)
    html = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # 2. Parse headers: # Header -> <h1>Header</h1>
    html = re.sub(r'^###\s+(.*?)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^##\s+(.*?)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^#\s+(.*?)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)

    # 3. Parse bold: **text** -> <strong>text</strong>
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)

    # 4. Parse italics: *text* -> <em>text</em>
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)

    # 5. Parse list items: * item or - item -> <li>item</li>
    html = re.sub(r'^[*-]\s+(.*?)$', r'<li>\1</li>', html, flags=re.MULTILINE)

    # 6. Parse paragraphs and wrap adjacent lists
    blocks = html.split("\n\n")
    paragraphs = []
    
    in_list = False
    list_items = []
    
    for block in blocks:
        block = block.strip()
        if not block:
            continue
            
        # If the block contains list items
        if block.startswith("<li>") or "<li>" in block:
            # If we were not previously in a list, start one
            if not in_list:
                in_list = True
            list_items.append(block)
        else:
            # If we were in a list, close it out first
            if in_list:
                paragraphs.append(f"<ul>{''.join(list_items)}</ul>")
                list_items = []
                in_list = False
                
            if block.startswith("<h"):
                paragraphs.append(block)
            else:
                block_br = block.replace("\n", "<br/>")
                paragraphs.append(f"<p>{block_br}</p>")
                
    # Close any trailing open list
    if in_list:
        paragraphs.append(f"<ul>{''.join(list_items)}</ul>")
        
    return "\n".join(paragraphs)


def strip_markdown(text: str) -> str:
    """
    Strips markdown symbols completely to return raw clean plain text.
    """
    if not text:
        return ""
        
    # Remove bold/italics markers
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    # Remove headers markers
    text = re.sub(r'^#+\s+', '', text, flags=re.MULTILINE)
    # Remove bullet points markers
    text = re.sub(r'^[*-]\s+', '', text, flags=re.MULTILINE)
    
    return text.strip()
