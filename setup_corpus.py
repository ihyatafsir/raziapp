#!/usr/bin/env python3
"""
setup_corpus.py

Hierarchical Corpus Classification for RaziApp:
1. Primary Classification: By Imam / Classical Author (Imam al-Razi, Imam al-Ghazali, Imam al-Nawawi, Imam al-Raghib, Classical Heritage)
2. Secondary Classification: By Epistemic Topic (Kalam & Metaphysics, Usul al-Fiqh, Tafsir, Hadith, Lisan, Tasawwuf, Hikmah, Fiqh)
3. Version Generation: v5 Sovereign Master & v4 Pro Lexical (incorporating Pure English & Bilingual Lexical Apparatus)
Strictly zero emojis.
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Any

SOURCE_EPUBS_DIR = Path("/home/absolut7/Documents/news/wyresup-mesh-app/public/epubs")
TARGET_EPUBS_DIR = Path(__file__).parent / "epubs"
CATALOG_PATH = Path(__file__).parent / "catalog.json"

# --- 1. Imams / Authors Hierarchy ---
IMAMS_MAP = {
    "razi": {
        "imam_id": "razi",
        "name": "Imam Fakhr al-Din al-Razi",
        "arabic_name": "الإِمَام فَخْر الدِّين الرَّازِي",
        "era": "544–606 AH / 1149–1209 CE",
        "title_honorific": "Shaykh al-Islam & Sultan al-Mutakallimin (سلطان المتكلمين)",
        "order": 1
    },
    "ghazali": {
        "imam_id": "ghazali",
        "name": "Hujjat al-Islam Imam Abu Hamid al-Ghazali",
        "arabic_name": "حُجَّة الإِسْلَام أَبُو حَامِد الغَزَالِي",
        "era": "450–505 AH / 1058–1111 CE",
        "title_honorific": "Proof of Islam & Mujaddid of the 5th Century (حجة الإسلام)",
        "order": 2
    },
    "nawawi": {
        "imam_id": "nawawi",
        "name": "Imam Yahya ibn Sharaf al-Nawawi",
        "arabic_name": "الإِمَام يَحْيَى بن شَرَف النَّوَوِي",
        "era": "631–676 AH / 1233–1277 CE",
        "title_honorific": "Muhyi al-Din & Master of Hadith (محيي الدين وشيخ المذهب)",
        "order": 3
    },
    "raghib": {
        "imam_id": "raghib",
        "name": "Imam al-Raghib al-Isfahani",
        "arabic_name": "الإِمَام الرَّاغِب الأَصْفَهَانِي",
        "era": "d. 502 AH / 1108 CE",
        "title_honorific": "Master of Quranic Semantics & Lexicology (إمام مفردات القرآن)",
        "order": 4
    },
    "heritage": {
        "imam_id": "heritage",
        "name": "Classical Heritage & Tasawwuf Masters",
        "arabic_name": "أَئِمَّة التُّرَاث النَّبَوِي وَالتَّصَوُّف السُّلُوكِي",
        "era": "5th–9th Century AH / Golden Age of Maghrebi & Andalusian Scholasticism",
        "title_honorific": "Qadi Iyad, Ibn Arabi, Al-Mawwaq, Al-Jazuli (عياض / ابن عربي / المواق / الجزولي)",
        "order": 5
    }
}

# --- 2. Epistemic Topics Hierarchy ---
TOPICS_MAP = {
    "kalam": {
        "topic_id": "kalam",
        "title": "Kalam & Metaphysics",
        "arabic_title": "الإِلَهِيَّات وَأُصُول الكَلَام",
        "order": 1
    },
    "usul": {
        "topic_id": "usul",
        "title": "Usul al-Fiqh & Legal Epistemology",
        "arabic_title": "أُصُول الفِقْه وَمَنَاهِج الاِسْتِدْلَال",
        "order": 2
    },
    "tafsir": {
        "topic_id": "tafsir",
        "title": "Tafsir & Quranic Sciences",
        "arabic_title": "التَّفْسِير وَعُلُوم القُرْآن",
        "order": 3
    },
    "hadith": {
        "topic_id": "hadith",
        "title": "Hadith & Prophetic Sunnah",
        "arabic_title": "الحَدِيث النَّبَوِي وَعُلُوم السُّنَّة",
        "order": 4
    },
    "lisan": {
        "topic_id": "lisan",
        "title": "Lisan, Semantics & Lexicon",
        "arabic_title": "عُلُوم اللِّسَان وَالمَعَاجِم",
        "order": 5
    },
    "tasawwuf": {
        "topic_id": "tasawwuf",
        "title": "Tasawwuf & Spiritual Ethics",
        "arabic_title": "التَّصَوُّف وَمَقَامَات السُّلُوك",
        "order": 6
    },
    "hikmah": {
        "topic_id": "hikmah",
        "title": "Logic & Philosophical Wisdom",
        "arabic_title": "المَنْطِق وَالحِكْمَة",
        "order": 7
    },
    "fiqh": {
        "topic_id": "fiqh",
        "title": "Applied Fiqh & Furūʿ",
        "arabic_title": "الفِقْه وَالأَحْكَام",
        "order": 8
    }
}

# --- 3. Canonical Book Titles Mapping ---
BOOK_TITLES_MAP = {
    # Classical Heritage
    "al_futuhat_al_makkiyya": ("The Meccan Illuminations (Al-Futuhat al-Makkiyya)", "الفُتُوحَات المَكِّيَّة", "tasawwuf"),
    "al_shifa_qadi_iyad": ("Kitab al-Shifa bi-Ta'rif Huquq al-Mustafa", "كِتَاب الشِّفَاء بِتَعْرِيف حُقُوق المُصْطَفَى", "tasawwuf"),
    "sunan_al_muhtadin": ("Sunan al-Muhtadin fi Maqamat al-Din", "سُنَن المُهْتَدِين فِي مَقَامَات الدِّين", "tasawwuf"),
    "takhmis_al_ghanima": ("Takhmis al-Ghanimah (Quintupling of the Spoils)", "تَخْمِيس الغَنِيمَة", "tasawwuf"),
    
    # Imam Razi
    "tafsir_kabir": ("The Great Exegesis (Mafatih al-Ghayb / Al-Tafsir al-Kabir)", "مَفَاتِيح الغَيْب / التَّفْسِير الكَبِير", "tafsir"),
    "al_matalib_al_aliyah": ("The Sublime Inquiries into Divine Knowledge (Al-Matalib al-'Aliyah)", "المَطَالِب العَالِيَة مِن العِلْم الإِلَهِي", "kalam"),
    "matalib": ("The Sublime Inquiries into Divine Knowledge (Al-Matalib al-'Aliyah)", "المَطَالِب العَالِيَة مِن العِلْم الإِلَهِي", "kalam"),
    "al_mahsul": ("The Harvest of Legal Theory (Al-Mahsul fi Usul al-Fiqh)", "المَحْصُول فِي عِلْم أُصُول الفِقْه", "usul"),
    "mahsul": ("The Harvest of Legal Theory (Al-Mahsul fi Usul al-Fiqh)", "المَحْصُول فِي عِلْم أُصُول الفِقْه", "usul"),
    "arbain_fi_usul_al_din": ("The Forty Propositions in Fundamental Principles (Kitab al-Arba'in)", "كِتَاب الأَرْبَعِين فِي أُصُول الدِّين", "kalam"),
    "arbain": ("The Forty Propositions in Fundamental Principles (Kitab al-Arba'in)", "كِتَاب الأَرْبَعِين فِي أُصُول الدِّين", "kalam"),
    "asas_al_taqdis": ("The Foundation of Transcendence (Asas al-Taqdis)", "أَسَاس التَّقْدِيس", "kalam"),
    "asas": ("The Foundation of Transcendence (Asas al-Taqdis)", "أَسَاس التَّقْدِيس", "kalam"),
    "lawami_al_bayyinat": ("The Radiant Proofs: Divine Names (Lawami' al-Bayyinat)", "لَوَامِع البَيِّنَات شَرْح أَسْمَاء الله تَعَالَى وَالصِّفَات", "kalam"),
    "lawami": ("The Radiant Proofs: Divine Names (Lawami' al-Bayyinat)", "لَوَامِع البَيِّنَات شَرْح أَسْمَاء الله تَعَالَى وَالصِّفَات", "kalam"),
    "ismat_al_anbiya": ("The Infallibility of the Prophets ('Ismat al-Anbiya)", "عِصْمَة الأَنْبِيَاء", "kalam"),
    "ismat": ("The Infallibility of the Prophets ('Ismat al-Anbiya)", "عِصْمَة الأَنْبِيَاء", "kalam"),
    "asrar_al_tanzil": ("Secrets of Revelation (Asrar al-Tanzil)", "أَسْرَار التَّنْزِيل وَأَنْوَار التَّأْوِيل", "tafsir"),
    "asrar_tanzil": ("Secrets of Revelation (Asrar al-Tanzil)", "أَسْرَار التَّنْزِيل وَأَنْوَار التَّأْوِيل", "tafsir"),
    "macalim_usul": ("The Waymarks of Fundamental Principles (Ma'alim Usul al-Din)", "مَعَالِم أُصُول الدِّين", "kalam"),
    "macalim": ("The Waymarks of Fundamental Principles (Ma'alim Usul al-Din)", "مَعَالِم أُصُول الدِّين", "kalam"),
    "al_mabahith_al_mashriqiyya": ("The Eastern Inquiries in Metaphysics (Al-Mabahith al-Mashriqiyya)", "المَبَاحِث المَشْرِقِيَّة", "hikmah"),
    "mabahith": ("The Eastern Inquiries in Metaphysics (Al-Mabahith al-Mashriqiyya)", "المَبَاحِث المَشْرِقِيَّة", "hikmah"),
    "sharh_al_isharat": ("Commentary on Ibn Sina's Pointers (Sharh al-Isharat)", "شَرْح الإِشَارَات وَالتَّنْبِيهَات", "hikmah"),
    "isharat": ("Commentary on Ibn Sina's Pointers (Sharh al-Isharat)", "شَرْح الإِشَارَات وَالتَّنْبِيهَات", "hikmah"),
    "al_mulakhkhas": ("The Compendium in Philosophy & Logic (Al-Mulakhkhas)", "المُلَخَّص فِي الحِكْمَة وَالمَنْطِق", "hikmah"),
    "mulakhkhas": ("The Compendium in Philosophy & Logic (Al-Mulakhkhas)", "المُلَخَّص فِي الحِكْمَة وَالمَنْطِق", "hikmah"),
    "jami_al_tafsir": ("The Universal Exegesis Compendium (Jami' al-Tafsir)", "جَامِع التَّفْسِير", "tafsir"),
    "qada_qadar": ("Treatise on Predestination and Free Will (Al-Qada' wal-Qadar)", "رِسَالَة فِي القَضَاء وَالقَدَر", "kalam"),
    "itiqadat_firaq": ("Beliefs of Islamic Sects (I'tiqadat Firaq al-Muslimin)", "اعْتِقَادَات فِرَق المُسْلِمِين وَالمُشْرِكِين", "kalam"),
    "risalah_fi_al_itiqad": ("Treatise on Pure Creed (Risalah fi al-I'tiqad)", "رِسَالَة فِي الاِعْتِقَاد", "kalam"),

    # Imam Ghazali
    "ihya_ulum_al_din": ("The Revival of the Religious Sciences (Ihya 'Ulum al-Din)", "إِحْيَاء عُلُوم الدِّين", "tasawwuf"),
    "ihya": ("The Revival of the Religious Sciences (Ihya 'Ulum al-Din)", "إِحْيَاء عُلُوم الدِّين", "tasawwuf"),
    "tahafut_al_falasifa": ("The Incoherence of the Philosophers (Tahafut al-Falasifa)", "تَهَافُت الفَلَاسِفَة", "kalam"),
    "tahafut": ("The Incoherence of the Philosophers (Tahafut al-Falasifa)", "تَهَافُت الفَلَاسِفَة", "kalam"),
    "al_mustasfa": ("The Quintessence of Legal Theory (Al-Mustasfa min 'Ilm al-Usul)", "المُسْتَصْفَى مِن عِلْم الأُصُول", "usul"),
    "mustasfa": ("The Quintessence of Legal Theory (Al-Mustasfa min 'Ilm al-Usul)", "المُسْتَصْفَى مِن عِلْم الأُصُول", "usul"),
    "al_mankhul": ("The Sifted Treatise on Legal Theory (Al-Mankhul)", "المَنْخُول مِن تَعْلِيقَات الأُصُول", "usul"),
    "mankhul": ("The Sifted Treatise on Legal Theory (Al-Mankhul)", "المَنْخُول مِن تَعْلِيقَات الأُصُول", "usul"),
    "shifa_al_ghalil": ("The Healing of the Inquirer (Shifa al-Ghalil fi al-Qiyas)", "شِفَاء الغَلِيل فِي بَيَان الشَّبَه وَالمُخِيل", "usul"),
    "al_iqtisad_fi_al_itiqad": ("The Middle Path in Creed (Al-Iqtisad fi al-I'tiqad)", "الاِقْتِصَاد فِي الاِعْتِقَاد", "kalam"),
    "iqtisad": ("The Middle Path in Creed (Al-Iqtisad fi al-I'tiqad)", "الاِقْتِصَاد فِي الاِعْتِقَاد", "kalam"),
    "al_maqsad_al_asna": ("The Noblest Aim: The 99 Divine Names (Al-Maqsad al-Asna)", "المَقْصَد الأَسْنَى فِي شَرْح مَعَانِي أَسْمَاء الله الحُسْنَى", "kalam"),
    "maqsad": ("The Noblest Aim: The 99 Divine Names (Al-Maqsad al-Asna)", "المَقْصَد الأَسْنَى فِي شَرْح مَعَانِي أَسْمَاء الله الحُسْنَى", "kalam"),
    "mishkat_al_anwar": ("The Niche of Lights (Mishkat al-Anwar)", "مِشْكَاة الأَنْوَار", "tasawwuf"),
    "mishkat": ("The Niche of Lights (Mishkat al-Anwar)", "مِشْكَاة الأَنْوَار", "tasawwuf"),
    "al_munqidh_min_al_dalal": ("Deliverance from Error (Al-Munqidh min al-Dalal)", "المُنْقِذ مِن الضَّلَال", "tasawwuf"),
    "munqidh": ("Deliverance from Error (Al-Munqidh min al-Dalal)", "المُنْقِذ مِن الضَّلَال", "tasawwuf"),
    "bidayat_al_hidayah": ("The Beginning of Guidance (Bidayat al-Hidayah)", "بِدَايَة الهِدَايَة", "tasawwuf"),
    "bidayat": ("The Beginning of Guidance (Bidayat al-Hidayah)", "بِدَايَة الهِدَايَة", "tasawwuf"),
    "minhaj_al_abidin": ("The Pathway of the Worshippers (Minhaj al-'Abidin)", "مِنْهَاج العَابِدِين إِلَى جَنَّة رَبّ العَالَمِين", "tasawwuf"),
    "miyar_al_ilm": ("The Standard of Knowledge in Logic (Mi'yar al-'Ilm)", "مِعْيَار العِلْم فِي فَنّ المَنْطِق", "hikmah"),
    "miyar": ("The Standard of Knowledge in Logic (Mi'yar al-'Ilm)", "مِعْيَار العِلْم فِي فَنّ المَنْطِق", "hikmah"),
    "mizan_al_amal": ("The Scale of Action in Ethics (Mizan al-'Amal)", "مِيزَان العَمَل", "hikmah"),
    "mizan": ("The Scale of Action in Ethics (Mizan al-'Amal)", "مِيزَان العَمَل", "hikmah"),
    "mihakk_al_nazar": ("The Touchstone of Proof in Logic (Mihakk al-Nazar)", "مِحَكّ النَّظَر فِي المَنْطِق", "hikmah"),
    "mihakk": ("The Touchstone of Proof in Logic (Mihakk al-Nazar)", "مِحَكّ النَّظَر فِي المَنْطِق", "hikmah"),
    "maqasid_al_falasifah": ("The Aims of the Philosophers (Maqasid al-Falasifah)", "مَقَاصِد الفَلَاسِفَة", "hikmah"),
    "maqasid": ("The Aims of the Philosophers (Maqasid al-Falasifah)", "مَقَاصِد الفَلَاسِفَة", "hikmah"),
    "fada_ih_al_batiniyya": ("The Infamies of the Esotericists (Fada'ih al-Batiniyya)", "فَضَائِح البَاطِنِيَّة", "kalam"),
    "fadaih": ("The Infamies of the Esotericists (Fada'ih al-Batiniyya)", "فَضَائِح البَاطِنِيَّة", "kalam"),
    "jawahir_al_quran": ("Jewels of the Quran (Jawahir al-Quran)", "جَوَاهِر القُرْآن", "tafsir"),
    "jawahir": ("Jewels of the Quran (Jawahir al-Quran)", "جَوَاهِر القُرْآن", "tafsir"),
    "qawaid_al_aqaid": ("Principles of Faith (Qawa'id al-'Aqa'id)", "قَوَاعِد العَقَائِد", "kalam"),
    "al_wasit": ("The Intermediate Treatise in Shafi'i Jurisprudence (Al-Wasit)", "الوَسِيط فِي المَذْهَب", "fiqh"),
    "kimiya_yi_saadat": ("The Alchemy of Happiness (Kimiya-yi Sa'adat)", "كِيمْيَاءِ سَعَادَت", "tasawwuf"),
    "maarij_al_quds": ("The Ascents of Holiness (Ma'arij al-Quds)", "مَعَارِج القُدْس فِي مَدَارِج مَعْرِفَة النَّفْس", "tasawwuf"),
    "sirr_al_alamin": ("The Secret of the Worlds (Sirr al-'Alamin)", "سِرّ العَالَمِين وَكَشْف مَا فِي الدَّارَيْن", "tasawwuf"),
    "asnaf_al_maghrurin": ("The Classes of the Deceived (Asnaf al-Maghrurin)", "أَصْنَاف المَغْرُورِين", "tasawwuf"),
    "al_radd_al_jamil": ("The Exquisite Refutation (Al-Radd al-Jamil)", "الرَّدّ الجَمِيل لِإِلَهِيَّة عِيسَى بِصَرِيح الإِنْجِيل", "kalam"),

    # Imam Nawawi
    "rawdat_al_talibin": ("Meadow of the Seekers (Rawdat al-Talibin)", "رَوْضَة الطَّالِبِين وَعُمْدَة المُفْتِين", "fiqh"),
    "rawdat": ("Meadow of the Seekers (Rawdat al-Talibin)", "رَوْضَة الطَّالِبِين وَعُمْدَة المُفْتِين", "fiqh"),
    "al_majmu": ("The Compendium: Commentary on Al-Muhadhdhab (Al-Majmu')", "المَجْمُوع شَرْح المُهَذَّب", "fiqh"),
    "majmu": ("The Compendium: Commentary on Al-Muhadhdhab (Al-Majmu')", "المَجْمُوع شَرْح المُهَذَّب", "fiqh"),
    "minhaj_al_talibin": ("The Pathway of the Seekers in Fiqh (Minhaj al-Talibin)", "مِنْهَاج الطَّالِبِين وَعُمْدَة المُتَّقِين", "fiqh"),
    "sharh_sahih_muslim": ("Commentary on Sahih Muslim (Al-Minhaj)", "المِنْهَاج شَرْح صَحِيح مُسْلِم", "hadith"),
    "riyad_al_salihin": ("The Meadows of the Righteous (Riyad al-Salihin)", "رِيَاض الصَّالِحِين", "hadith"),
    "riyad": ("The Meadows of the Righteous (Riyad al-Salihin)", "رِيَاض الصَّالِحِين", "hadith"),
    "al_arbaun_al_nawawiyya": ("The Forty Hadiths of Imam al-Nawawi", "الأَرْبَعُون النَّوَوِيَّة", "hadith"),
    "arbaun_al_nawawiyya": ("The Forty Hadiths of Imam al-Nawawi", "الأَرْبَعُون النَّوَوِيَّة", "hadith"),
    "adab_al_fatwa": ("Etiquette of the Mufti & Inquirer (Adab al-Fatwa)", "أَدَب الفَتْوَى وَالمُفْتِي وَالمُسْتَفْتِي", "usul"),
    "al_tibyan": ("Etiquette with the Quran (Al-Tibyan fi Adab Hamalat al-Quran)", "التِّبْيَان فِي آدَاب حَمَلَة القُرْآن", "tasawwuf"),
    "tibyan": ("Etiquette with the Quran (Al-Tibyan fi Adab Hamalat al-Quran)", "التِّبْيَان فِي آدَاب حَمَلَة القُرْآن", "tasawwuf"),
    "kitab_al_adhkar": ("The Invocations of the Day & Night (Al-Adhkar)", "الأَذْكَار المُنْتَخَبَة مِن كَلَام سَيِّد الأَبْرَار", "tasawwuf"),
    "adhkar": ("The Invocations of the Day & Night (Al-Adhkar)", "الأَذْكَار المُنْتَخَبَة مِن كَلَام سَيِّد الأَبْرَار", "tasawwuf"),
    "tahdhib_al_asma": ("Refinement of Names and Attributes (Tahdhib al-Asma')", "تَهْذِيب الأَسْمَاء وَاللُّغَات", "lisan"),
    "tahrir_alfaz_al_tanbih": ("The Explication of Terms in Al-Tanbih (Tahrir Alfaz al-Tanbih)", "تَحْرِير أَلْفَاظ التَّنْبِيه", "lisan"),
    "al_idah_fi_manasik_al_hajj": ("Clarification of the Rites of Hajj (Al-Idah)", "الإِيضَاح فِي مَنَاسِك الحَجّ", "fiqh"),
    "al_ijaz_fi_sharh_sunan_abi_dawud": ("Commentary on Sunan Abi Dawud (Al-Ijaz)", "الإِيجَاز فِي شَرْح سُنَن أَبِي دَاوُد", "hadith"),
    "adab_ikhtilat_al_nas": ("Etiquette of Social Interaction (Adab Ikhtilat al-Nas)", "أَدَب اخْتِلَاط النَّاس", "tasawwuf"),
    "khulasat_al_ahkam": ("The Quintessence of Rulings in Hadith (Khulasat al-Ahkam)", "خُلَاصَة الأَحْكَام فِي مُهِمَّات السُّنَن وَقَوَاعِد الإِسْلَام", "hadith"),
    "irshad_tullab_al_haqaiq": ("Guidance for Seekers of Truth in Hadith (Irshad Tullab al-Haqaiq)", "إِرْشَاد طُلَّاب الحَقَائِق إِلَى مَعْرِفَة سُنَن خَيْر الخَلَائِق", "hadith"),
    "bustan_al_arifin": ("The Orchard of the Gnostics (Bustan al-Arifin)", "بُسْتَان العَارِفِين", "tasawwuf"),
    "daqaiq_al_minhaj": ("Subtleties of Al-Minhaj (Daqaiq al-Minhaj)", "دَقَائِق المِنْهَاج", "fiqh"),
    "al_masail_al_manthurah": ("The Scattered Responsa (Al-Masail al-Manthurah / Fatawa al-Nawawi)", "المَسَائِل المَنْثُورَة (فَتَاوَى النَّوَوِي)", "fiqh"),

    # Imam Raghib
    "al_mufradat_fi_gharib_al_quran": ("Lexicon of Quranic Semantics (Mufradat Alfaz al-Quran)", "مُفْرَدَات أَلْفَاظ القُرْآن", "lisan"),
    "mufradat": ("Lexicon of Quranic Semantics (Mufradat Alfaz al-Quran)", "مُفْرَدَات أَلْفَاظ القُرْآن", "lisan"),
    "al_dhariah_ila_makarim_al_shariah": ("The Pathway to Noble Virtues (Al-Dhari'ah)", "الذَّرِيعَة إِلَى مَكَارِم الشَّرِيعَة", "hikmah"),
    "dhariah": ("The Pathway to Noble Virtues (Al-Dhari'ah)", "الذَّرِيعَة إِلَى مَكَارِم الشَّرِيعَة", "hikmah"),
    "tafsil_al_nashatayn": ("Detailing the Two States of Man (Tafsil al-Nash'atayn)", "تَفْصِيل النَّشْأَتَيْن وَتَحْصِيل السَّعَادَتَيْن", "hikmah"),
    "muhadarat_al_udaba": ("Lectures of the Literati (Muhadarat al-Udaba')", "مُحَاضَرَات الأُدَبَاء وَمُحَاوَرَات الشُّعَرَاء وَالبُلَغَاء", "lisan")
}

def get_work_slug(fname: str) -> str:
    s = fname.replace(".epub", "")
    vol_match = re.search(r'(?:vol|volume)[_-]?(\d+)', s, re.I)
    vol_suffix = f"_vol_{int(vol_match.group(1)):02d}" if vol_match else ""
    
    if "tafsir_kabir" in s:
        if vol_match: return f"tafsir_kabir{vol_suffix}"
        return "tafsir_kabir_omnibus"
    elif "matalib" in s:
        if "complete" in s or "omnibus" in s or not vol_match: return "matalib_omnibus"
        return f"matalib{vol_suffix}"
    elif "ihya" in s:
        if vol_match: return f"ihya{vol_suffix}"
        return "ihya_omnibus"
    elif "ismat" in s: return "ismat_anbiya"
    elif "asas" in s: return "asas_taqdis"
    elif "lawami" in s: return "lawami_bayyinat"
    elif "qada_qadar" in s or "qada_wal_qadar" in s: return "qada_qadar"
    elif "mahsul" in s: return "mahsul"
    elif "macalim" in s: return "macalim_usul_aldin"
    elif "itiqadat" in s: return "itiqadat_firaq"
    elif "asrar_tanzil" in s: return "asrar_tanzil"
    elif "tahafut" in s: return "tahafut_al_falasifa"
    elif "mustasfa" in s: return "mustasfa"
    elif "mankhul" in s: return "mankhul"
    elif "shifa_al_ghalil" in s: return "shifa_al_ghalil"
    elif "iqtisad" in s: return "iqtisad"
    elif "maqsad" in s: return "maqsad"
    elif "mishkat" in s: return "mishkat"
    elif "munqidh" in s: return "munqidh"
    elif "bidayat" in s: return "bidayat"
    elif "minhaj_al_abidin" in s: return "minhaj_al_abidin"
    elif "miyar" in s: return "miyar_al_ilm"
    elif "mizan" in s: return "mizan_al_amal"
    elif "mihakk" in s: return "mihakk_al_nazar"
    elif "maqasid" in s: return "maqasid_al_falasifah"
    elif "fadaih" in s: return "fadaih_al_batiniyya"
    elif "jawahir" in s: return "jawahir_al_quran"
    elif "qawaid" in s: return "qawaid_al_aqaid"
    elif "wasit" in s: return "al_wasit"
    elif "kimiya" in s: return "kimiya_yi_saadat"
    elif "maarij" in s: return "maarij_al_quds"
    elif "sirr_al_alamin" in s: return "sirr_al_alamin"
    elif "asnaf" in s: return "asnaf_al_maghrurin"
    elif "radd_al_jamil" in s: return "al_radd_al_jamil"
    elif "rawdat" in s: return "rawdat_al_talibin"
    elif "majmu" in s and "sharh" in s: return "al_majmu_nawawi"
    elif "majmuat_rasail" in s: return "majmuat_rasail_ghazali"
    elif "minhaj_al_talibin" in s: return "minhaj_al_talibin"
    elif "sahih_muslim" in s: return "sharh_sahih_muslim"
    elif "riyad" in s: return "riyad_al_salihin"
    elif "arbaun" in s or "arbain" in s:
        if "nawawi" in s: return "arbaun_nawawi"
        return "arbain_razi"
    elif "adab_al_fatwa" in s: return "adab_al_fatwa"
    elif "tibyan" in s: return "al_tibyan"
    elif "adhkar" in s: return "kitab_al_adhkar"
    elif "tahdhib" in s: return "tahdhib_al_asma"
    elif "tahrir" in s: return "tahrir_alfaz_al_tanbih"
    elif "idah" in s: return "al_idah_manasik"
    elif "ijaz" in s: return "al_ijaz_sunan_abi_dawud"
    elif "adab_ikhtilat" in s: return "adab_ikhtilat_al_nas"
    elif "khulasat" in s: return "khulasat_al_ahkam"
    elif "irshad_tullab" in s: return "irshad_tullab_al_haqaiq"
    elif "bustan" in s: return "bustan_al_arifin"
    elif "daqaiq" in s: return "daqaiq_al_minhaj"
    elif "masail_al_manthurah" in s: return "al_masail_al_manthurah"
    elif "mufradat" in s: return "al_mufradat"
    elif "dhariah" in s: return "al_dhariah"
    elif "tafsil" in s: return "tafsil_al_nashatayn"
    elif "muhadarat" in s: return "muhadarat_al_udaba"
    elif "futuhat" in s: return "al_futuhat_al_makkiyya"
    elif "shifa" in s and ("qadi" in s or "iyad" in s): return "al_shifa_qadi_iyad"
    elif "sunan_al_muhtadin" in s or "sanan" in s or "senan" in s: return "sunan_al_muhtadin"
    elif "takhmis" in s: return "takhmis_al_ghanima"
    elif "jami_al_tafsir" in s: return "jami_al_tafsir"
    elif "tibr" in s: return "al_tibr_al_masbuk"
    elif "taqrib" in s: return "al_taqrib_wa_al_taysir"
    elif "risalah_fi_al_itiqad" in s: return "risalah_fi_al_itiqad"
    elif "usul_wa_al_dawabit" in s: return "al_usul_wa_al_dawabit"
    return s

def version_score(b: Dict[str, Any]) -> int:
    fname = b.get("filename", "")
    score = 0
    if "v5" in fname or "zero_truncation" in fname or "complete_76sections" in fname:
        score += 500
    elif "v4" in fname or "7roots" in fname:
        score += 400
    elif "v3" in fname or "ar_lex" in fname:
        score += 300
    elif "v2" in fname:
        score += 200
    elif "guided" in fname:
        score += 150
    else:
        score += 100
        
    if "bilingual_lexical_en" in fname: score += 80
    elif "pure_en" in fname: score += 70
    elif "oversight_critical" in fname: score += 90
    elif "complete" in fname: score += 60
    
    if fname in ["sanan.epub", "senan2.epub", "senanebook.epub", "footnoteless_book.epub", "bilingual_book.epub"]:
        score -= 300
    return score

def setup_corpus() -> List[Dict[str, Any]]:
    TARGET_EPUBS_DIR.mkdir(parents=True, exist_ok=True)
    if not SOURCE_EPUBS_DIR.exists():
        print(f"Notice: Source directory {SOURCE_EPUBS_DIR} not found.")
        return []

    books = []
    epub_files = sorted(list(SOURCE_EPUBS_DIR.glob("*.epub")))
    print(f"Indexing {len(epub_files)} source EPUB masterworks...")

    for idx, epub_path in enumerate(epub_files):
        target_link = TARGET_EPUBS_DIR / epub_path.name
        if not target_link.exists():
            try:
                target_link.symlink_to(epub_path)
            except Exception:
                pass

        fname = epub_path.name
        size_bytes = epub_path.stat().st_size
        size_mb = round(size_bytes / (1024 * 1024), 2)

        # 1. Imam / Author Identification
        imam_key = "heritage"
        if any(k in fname for k in ["futuhat", "shifa_qadi", "sunan_al_muhtadin", "takhmis", "sanan", "senan"]):
            imam_key = "heritage"
        elif any(k in fname for k in ["tafsir_kabir", "matalib", "mahsul", "asas", "lawami", "ismat", "asrar_tanzil", "mabahith", "isharat", "mulakhkhas", "macalim", "qada_qadar", "razi", "itiqadat_firaq"]):
            imam_key = "razi"
        elif any(k in fname for k in ["ihya", "tahafut", "ghazali", "mustasfa", "mankhul", "miyar", "mizan", "mishkat", "munqidh", "bidayat", "fadaih", "iqtisad", "maqsad", "shifa_al_ghalil", "asnaf", "kimiya", "maarij", "maqasid", "qawaid_al_aqaid", "sirr_al_alamin"]):
            imam_key = "ghazali"
        elif any(k in fname for k in ["nawawi", "rawdat", "majmu", "riyad", "tahdhib", "arbaun", "tahrir", "tibyan", "muslim", "adhkar", "adab_al_fatwa", "adab_ikhtilat", "al_idah", "al_ijaz", "bustan_al_arifin", "daqaiq_al_minhaj", "irshad_tullab", "khulasat_al_ahkam", "minhaj_al_talibin", "al_masail_al_manthurah"]):
            imam_key = "nawawi"
        elif any(k in fname for k in ["raghib", "mufradat", "tafsil", "dhariah", "muhadarat_al_udaba"]):
            imam_key = "raghib"

        imam_meta = IMAMS_MAP[imam_key]

        # 2. Title & Epistemic Topic Mapping
        english_title = fname.replace(".epub", "").replace("_", " ").title()
        arabic_title = ""
        topic_key = "kalam"

        for k, (en, ar, top) in BOOK_TITLES_MAP.items():
            if k in fname:
                english_title = en
                arabic_title = ar
                topic_key = top
                break

        # Handle Volume Specific Titles
        vol_match = re.search(r'vol[_-]?(\d+)', fname, re.I)
        if vol_match:
            vol_num = int(vol_match.group(1))
            if "tafsir_kabir" in fname:
                english_title = f"The Great Exegesis (Mafatih al-Ghayb) — Volume {vol_num:02d}"
                arabic_title = f"مَفَاتِيح الغَيْب (التَّفْسِير الكَبِير) — المجلد {vol_num}"
                topic_key = "tafsir"
            elif "matalib" in fname:
                english_title = f"The Sublime Inquiries into Divine Knowledge (Al-Matalib al-'Aliyah) — Volume {vol_num:02d}"
                arabic_title = f"المَطَالِب العَالِيَة مِن العِلْم الإِلَهِي — المجلد {vol_num}"
                topic_key = "kalam"
            elif "ihya" in fname:
                ihya_parts = {
                    1: "Rub' al-'Ibadat (Acts of Worship)",
                    2: "Rub' al-'Adat (Norms of Daily Life)",
                    3: "Rub' al-Muhlikat (Vices & Destructive Traits)",
                    4: "Rub' al-Munjiyat (Virtues & Saving Traits)"
                }
                sub = ihya_parts.get(vol_num, f"Volume {vol_num:02d}")
                english_title = f"The Revival of the Religious Sciences (Ihya 'Ulum al-Din) — {sub}"
                topic_key = "tasawwuf"

        topic_meta = TOPICS_MAP.get(topic_key, TOPICS_MAP["kalam"])

        # 3. Comprehensive Version & Format Classification (v4 / v5 Pure EN & Bilingual Lexical)
        is_sq = "_sq" in fname or "albanian" in fname
        is_bilingual = "bilingual" in fname or "lexical" in fname or "ar_lex" in fname
        # All non-bilingual, non-Albanian works in this translated corpus are Pure English Scholarly Editions
        is_pure_en = not is_sq and not is_bilingual

        is_critical = "oversight" in fname or "critical" in fname
        is_explicit_v5 = "v5" in fname or "zero_truncation" in fname or "complete_76sections" in fname
        is_explicit_v4 = "v4" in fname
        is_omnibus = "complete" in fname or "omnibus" in fname or size_mb >= 2.0 or "futuhat" in fname

        # Edition Format Key
        if is_pure_en:
            edition_format = "pure_en"
        elif is_bilingual:
            edition_format = "bilingual"
        elif is_sq:
            edition_format = "sq"
        else:
            edition_format = "standard"

        # Version Assignment: All valid scholarly editions belong to the v4/v5 translation corpus
        if is_explicit_v5 or is_critical or is_omnibus or "futuhat" in fname:
            version_tag = "v5"
            if is_pure_en:
                edition_name = "v5 Pure English Sovereign Masterwork"
            elif is_bilingual:
                edition_name = "v5 Bilingual Lexical Sovereign Edition"
            elif is_critical:
                edition_name = "v5 Critical Scholarly Oversight Edition"
            elif is_sq:
                edition_name = "v5 Albanian Sovereign Masterwork (Shqip)"
            else:
                edition_name = "v5 Sovereign Master Edition"
        else:
            version_tag = "v4"
            if is_pure_en:
                edition_name = "v4 Pure English Scholarly Edition"
            elif is_bilingual:
                edition_name = "v4 Bilingual Lexical Apparatus"
            elif is_sq:
                edition_name = "v4 Albanian Classical Edition (Shqip)"
            elif "vol_" in fname:
                edition_name = "v4 Volume Scholarly Edition"
            else:
                edition_name = "v4 Sovereign Translation Edition"

        # All 246 volumes in this corpus are sovereign translations (v4 or v5)
        is_v4_v5 = True

        # Heritage Flag Check
        is_heritage_new = imam_key == "heritage" and any(k in fname for k in ["futuhat", "shifa_qadi", "sunan_al_muhtadin", "takhmis"])

        book_info = {
            "id": f"codex_{idx + 1}",
            "filename": fname,
            "path": str(target_link),
            "size_mb": size_mb,
            "work_slug": get_work_slug(fname),
            # Imam & Author
            "imam_key": imam_key,
            "author_key": imam_key,
            "author_tag": imam_key,
            "author": imam_meta["name"],
            "author_arabic": imam_meta["arabic_name"],
            "era": imam_meta["era"],
            "honorific": imam_meta["title_honorific"],
            "imam_order": imam_meta["order"],
            # Epistemic Topic & Pillar
            "topic_key": topic_key,
            "topic_name": topic_meta["title"],
            "topic_arabic": topic_meta["arabic_title"],
            "topic_order": topic_meta["order"],
            "pillar_key": topic_key if topic_key in ["kalam", "usul", "lisan", "tasawwuf"] else "kalam",
            "pillar_name": topic_meta["title"],
            # Title, Edition & Versioning
            "title": english_title,
            "arabic_title": arabic_title,
            "version": version_tag,
            "edition_format": edition_format,
            "is_v4_v5": is_v4_v5,
            "edition": edition_name,
            "edition_type": edition_name,
            "is_pure_en": is_pure_en,
            "is_bilingual": is_bilingual,
            "is_sq": is_sq,
            "is_heritage_new": is_heritage_new
        }
        books.append(book_info)

    # Filter: Select strictly the two latest versions of each work (Pure English + Bilingual Apparatus)
    work_groups = {}
    for b in books:
        slug = b["work_slug"]
        if slug not in work_groups:
            work_groups[slug] = []
        work_groups[slug].append(b)

    filtered_books = []
    for slug, group in work_groups.items():
        pure_cands = [b for b in group if b["is_pure_en"]]
        bilingual_cands = [b for b in group if b["is_bilingual"]]
        sq_cands = [b for b in group if b["is_sq"]]

        pure_cands.sort(key=lambda b: (-version_score(b), -b["size_mb"]))
        bilingual_cands.sort(key=lambda b: (-version_score(b), -b["size_mb"]))
        sq_cands.sort(key=lambda b: (-version_score(b), -b["size_mb"]))

        chosen = []
        if pure_cands:
            chosen.append(pure_cands[0])
        if bilingual_cands:
            chosen.append(bilingual_cands[0])

        if len(chosen) < 2:
            group.sort(key=lambda b: (-version_score(b), -b["size_mb"]))
            for b in group:
                if b not in chosen and version_score(b) > 0:
                    chosen.append(b)
                    if len(chosen) == 2:
                        break

        filtered_books.extend(chosen[:2])

    books = filtered_books

    # Hierarchical Sorting:
    # 1. Imam Order (Razi, Ghazali, Nawawi, Raghib, Heritage)
    # 2. Topic Order (Kalam, Usul, Tafsir, Hadith, Lisan, Tasawwuf, Hikmah, Fiqh)
    # 3. Version Preference (v5 first, then v4)
    # 4. Pure English / Bilingual ordering
    # 5. Book Title / Size
    def sort_key(b):
        ver_prio = 0 if b["version"] == "v5" else 1
        format_prio = 0 if b["is_pure_en"] else 1
        return (
            b["imam_order"],
            b["topic_order"],
            ver_prio,
            format_prio,
            -b["size_mb"],
            b["title"]
        )

    books.sort(key=sort_key)

    # Re-index clean IDs
    for i, b in enumerate(books):
        b["id"] = f"codex_{i + 1}"

    v5_count = len([b for b in books if b["version"] == "v5"])
    v4_count = len([b for b in books if b["version"] == "v4"])
    pure_count = len([b for b in books if b["is_pure_en"]])
    bilingual_count = len([b for b in books if b["is_bilingual"]])
    sq_count = len([b for b in books if b["is_sq"]])

    catalog_data = {
        "imams": IMAMS_MAP,
        "topics": TOPICS_MAP,
        "total_books": len(books),
        "v5_total": v5_count,
        "v4_total": v4_count,
        "pure_en_total": pure_count,
        "bilingual_total": bilingual_count,
        "sq_total": sq_count,
        "books": books
    }

    CATALOG_PATH.write_text(json.dumps(books, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Catalog generated: {len(books)} curated masterworks ({v5_count} v5, {v4_count} v4, {pure_count} Pure English, {bilingual_count} Bilingual, {sq_count} Albanian) -> {CATALOG_PATH}")
    return books

if __name__ == "__main__":
    setup_corpus()
