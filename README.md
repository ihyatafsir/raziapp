# RaziApp: Sovereign Dialectical Reader & Classical Corpus

Mobile-first scholarly e-reader and dialectical exploration platform grounded in the epistemic methodology of Imam Fakhr al-Din al-Razi (544–606 AH / 1149–1209 CE) and the classical masters of Islamic thought.

## Core Features

- **Mobile-Only Sovereignty**: Crafted for high-density mobile reading with haptic responsiveness, gesture-driven page wipes, and ergonomic bottom-dock navigation.
- **Fullscreen EPUB Side Page Wipe**: Hardware-accelerated sliding page turns with velocity-based flick gestures, customizable typography (Georgia, Amiri, Scheherazade, Iosevka), dynamic line spacing, and ambient reading themes (Nocturne, Emerald, Sepia, Pristine).
- **Hierarchical Imam & Topic Taxonomy**:
  - **Primary Classification by Master**: *Imam Fakhr al-Din al-Razi*, *Hujjat al-Islam Imam al-Ghazali*, *Imam Yahya ibn Sharaf al-Nawawi*, *Imam al-Raghib al-Isfahani*, and *Classical Heritage Masters* (*Ibn Arabi*, *Qadi Iyad*, *Al-Mawwaq*, *Al-Jazuli*).
  - **Secondary Epistemic Division**: *Kalam & Metaphysics*, *Usul al-Fiqh*, *Tafsir*, *Hadith*, *Lisan & Lexicon*, *Tasawwuf*, *Hikmah & Logic*, *Applied Fiqh*.
- **v4 Pro & v5 Sovereign Masterwork Editions**:
  - **Pure English Scholarly Translations (147 Volumes)**: Complete unadulterated English texts decomposed into dialectical logical blocks.
  - **Bilingual Lexical Apparatus (95 Volumes)**: Full Arabic texts with root-by-root lexical analysis, grammatical annotations, and English translations.
  - **Albanian Classical Heritage (4 Volumes)**: Specialized Shqip translations of foundational masterworks.
- **Al-Muhaqqiq AI Companion**: Deep dialectical analysis powered by DeepSeek Flash 4.1 with instant syllogism extraction, objection deconstruction, and Arabic root analysis.
- **Classical Arabic Audio Engine**: Authentic reciter playback for classical Arabic passages.
- **Strict Zero-Emoji Policy**: Pure scholastic typography and clean SVG iconography.

## Architecture

- **Backend**: Python 3 / FastAPI / Uvicorn with dynamic catalog indexing and live taxonomy aggregation.
- **Frontend**: Vanilla HTML5 / ES6 JavaScript / Vanilla CSS with zero external dependencies.
- **EPUB Parser**: Native Python EPUB3 decompression engine extracting HTML chapters and classifying paragraphs into dialectical modes (*Mas'alah*, *Burhan*, *In Qila*, *Qulna*, *Taqsim*).

## Quick Start

```bash
# Clone the repository
git clone git@github.com:ihyatafsir/raziapp.git
cd raziapp

# Install Python dependencies
pip install fastapi uvicorn beautifulsoup4

# Index the classical corpus
python3 setup_corpus.py

# Launch the server
python3 server.py
```

Open `http://localhost:5200` on your mobile device or browser.

## License

Scholarly Open Distribution.
