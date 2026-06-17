import re
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
import requests

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache for feed data
_cache = {
    "data": None
}

def parse_cdata_content(content_html):
    # Splits the HTML content by <h3> tags
    parts = re.split(r'<h3[^>]*>(.*?)</h3>', content_html, flags=re.IGNORECASE)
    updates = []
    
    if len(parts) > 1:
        # The first part is before the first <h3> (usually empty or whitespace)
        # Subsequent parts alternate between [type, HTML content]
        for i in range(1, len(parts), 2):
            update_type = parts[i].strip()
            update_html = parts[i+1].strip() if i+1 < len(parts) else ""
            updates.append({
                "type": update_type,
                "html": update_html
            })
    else:
        # Fallback if no <h3> tags are found
        updates.append({
            "type": "General",
            "html": content_html
        })
    return updates

def fetch_and_parse_feed():
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse Atom feed XML
        namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(response.content)
        
        entries = []
        for entry_node in root.findall('atom:entry', namespaces):
            title = entry_node.find('atom:title', namespaces)
            entry_id = entry_node.find('atom:id', namespaces)
            updated = entry_node.find('atom:updated', namespaces)
            
            # Link node could have rel="alternate"
            link_node = entry_node.find("atom:link[@rel='alternate']", namespaces)
            if link_node is None:
                link_node = entry_node.find("atom:link", namespaces)
            
            link = link_node.attrib.get('href', '') if link_node is not None else ''
            
            content_node = entry_node.find('atom:content', namespaces)
            content_html = content_node.text if content_node is not None else ''
            
            date_str = title.text if title is not None else 'Unknown Date'
            updated_str = updated.text if updated is not None else ''
            id_str = entry_id.text if entry_id is not None else ''
            
            # Clean up the ID to be a simple hash/anchor
            if "#" in id_str:
                anchor = id_str.split("#")[-1]
            else:
                anchor = date_str.replace(" ", "_")
                
            updates = parse_cdata_content(content_html)
            
            entries.append({
                "date": date_str,
                "updated": updated_str,
                "anchor": anchor,
                "link": link,
                "updates": updates
            })
            
        return {"success": True, "entries": entries}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    if force_refresh or _cache["data"] is None:
        result = fetch_and_parse_feed()
        if result["success"]:
            _cache["data"] = result["entries"]
        else:
            return jsonify({"error": result["error"]}), 500
            
    return jsonify({"entries": _cache["data"]})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
