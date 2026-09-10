#!/usr/bin/env bash
# start_raziapp.sh — Launch RaziApp Dialectical EPUB Reader (Port 5200)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT="${PORT:-5200}"

echo "========================================================================"
echo "RaziApp: Dialectical EPUB Reader & Scholarly Audio Ecosystem"
echo "نِظَامُ الرَّازِي لِلتَّحْقِيقِ النَّظَرِيِّ وَالسَّمَاعِ الحَكِيم"
echo "========================================================================"
echo "• Port: $PORT"
echo "• Local URL: http://localhost:$PORT"
echo "• Scholars: Imam Fakhr al-Din al-Razi, Imam al-Ghazali, Imam al-Nawawi"
echo "• Audio Engine: Shaykh Hamza Yusuf Scholarly Neural Cadence"
echo "• Dialectical AI: DeepSeek Flash 4.1 + Local Ollama Gating"
echo "========================================================================"

# Kill any existing server on this port
fuser -k "${PORT}/tcp" 2>/dev/null || true

python3 server.py
