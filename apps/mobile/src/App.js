import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Palette ─────────────────────────────────────────────────────────────────
// Old Rose #d88c9a · Soft Apricot #f2d0a9 · Almond Cream #f1e3d3 · Muted Teal #99c1b9

const palette = {
  light: {
    background: '#F7F9FA',
    text: '#1F2A30',
    primary: '#4F6D7A',
    accent: '#7FAE9F',
    card: '#FFFFFF',
    border: '#D0DBE0',
    muted: '#A7B6BE',
    mutedBg: '#EDF2F4',
    nav: '#FFFFFF',
    success: '#7FAE9F',
    successBg: '#EAF3F0'
  },
  dark: {
    background: '#111A1F',
    text: '#E8EEF1',
    primary: '#6B8FA0',
    accent: '#7FAE9F',
    card: '#1A2630',
    border: '#2A3A44',
    muted: '#7A9099',
    mutedBg: '#1E2E38',
    nav: '#151F26',
    success: '#7FAE9F',
    successBg: '#1A2E2A'
  }
};

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
  de: {
    // Search/Discover tab
    heroTitle: 'Den richtigen Physio\nfür dein Problem finden.',
    heroSub: 'Geprüfte Physiotherapeuten in deiner Nähe — nach Beschwerde suchen, nicht nach Name.',
    searchPlaceholder: 'Wobei brauchst du Hilfe?',
    searchBtn: 'Suchen',
    resultsLabel: 'Ergebnis',
    resultsLabelPlural: 'Ergebnisse',
    verifiedOnly: 'Nur geprüfte Profile',
    noResults: 'Keine Ergebnisse',
    noResultsBody: 'Versuche einen anderen Suchbegriff oder erweitere den Umkreis.',
    loading: 'Suche läuft…',
    homeVisitLabel: 'Hausbesuche',
    homeVisitToggle: 'Nur Therapeuten mit Hausbesuchen',
    homeVisitTag: 'Hausbesuch',
    filterTitle: 'Filter',
    kassenartLabel: 'Kassenart',
    languageFilter: 'Sprache',
    fortbildungLabel: 'Fortbildungen',
    allOption: 'Alle',
    locationPlaceholder: 'Standort wählen',
    callPractice: '📞 Praxis anrufen',
    // Tabs
    tabSearch: 'Suchen',
    tabFavorites: 'Favoriten',
    tabTherapist: 'Therapeuten',
    tabOptions: 'Optionen',
    // Favorites
    favoritesTitle: 'Favoriten',
    favoritesEmpty: 'Noch keine Favoriten',
    favoritesEmptyBody: 'Tippe auf das Herz-Symbol bei einem Therapeuten oder einer Praxis, um sie hier zu speichern.',
    favoritesHint: 'Lokal gespeichert · nicht synchronisiert · nur für dich sichtbar',
    favoritesTherapists: 'Therapeuten',
    favoritesPractices: 'Praxen',
    // Options
    optionsTitle: 'Optionen',
    optionsSubtitle: 'Einstellungen & Informationen',
    languageOption: 'Sprache',
    privacyOption: 'Datenschutz',
    imprintOption: 'Impressum',
    appVersionOption: 'App-Version',
    comingSoon: 'Bald verfügbar',
    appearanceOption: 'Erscheinungsbild',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    themeSystem: 'System',
    logoutBtn: 'Abmelden',
    deleteAccount: 'Konto löschen',
    deleteAccountConfirmTitle: 'Konto wirklich löschen?',
    deleteAccountConfirmMsg: 'Dein Profil und alle Daten werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
    deleteAccountConfirmBtn: 'Endgültig löschen',
    myPractice: 'MEINE PRAXIS',
    managePractice: 'Verwalten',
    newPractice: 'Neue Praxis erstellen',
    linkPractice: 'Praxis vernetzen',
    notLoggedIn: 'Nicht angemeldet',
    loginAction: 'Anmelden',
    // Practice / Therapist profile
    backBtn: 'Zurück',
    openInMaps: 'In Karte öffnen',
    distanceLabel: 'Entfernung',
    hoursLabel: 'Öffnungszeiten',
    addressLabel: 'Adresse',
    availabilityLabel: 'Sprechzeiten',
    insuranceLabel: 'Kassenart',
    specsLabel: 'Spezialisierungen',
    certsLabel: 'Fortbildungen',
    aboutLabel: 'Über mich',
    practicesLabel: 'Praxis',
    therapistsLabel: 'Therapeuten',
    behandlungLabel: 'Behandlungsbereiche',
    detailsLabel: 'Details',
    // Location sheet
    locationTitle: 'Wo suchst du?',
    locationSub: 'Wir brauchen deinen Standort, um Therapeuten in deiner Nähe zu finden.',
    useGPS: 'Aktuellen Standort verwenden',
    gpsLoading: 'Standort wird ermittelt …',
    locationDivider: 'oder Stadt eingeben',
    confirmLocation: 'Weiter',
  },
  en: {
    // Search/Discover tab
    heroTitle: 'Find the right physio\nfor your problem.',
    heroSub: 'Verified physiotherapists near you — search by condition, not by name.',
    searchPlaceholder: 'What do you need help with?',
    searchBtn: 'Search',
    resultsLabel: 'Result',
    resultsLabelPlural: 'Results',
    verifiedOnly: 'Verified profiles only',
    noResults: 'No results',
    noResultsBody: 'Try a different search term or expand the radius.',
    loading: 'Searching…',
    homeVisitLabel: 'Home visits',
    homeVisitToggle: 'Only therapists with home visits',
    homeVisitTag: 'Home visit',
    filterTitle: 'Filter',
    kassenartLabel: 'Insurance type',
    languageFilter: 'Language',
    fortbildungLabel: 'Qualifications',
    allOption: 'All',
    locationPlaceholder: 'Select location',
    callPractice: '📞 Call practice',
    // Tabs
    tabSearch: 'Search',
    tabFavorites: 'Favorites',
    tabTherapist: 'Therapists',
    tabOptions: 'Options',
    // Favorites
    favoritesTitle: 'Favorites',
    favoritesEmpty: 'No favorites yet',
    favoritesEmptyBody: 'Tap the heart icon on a therapist or practice to save them here.',
    favoritesHint: 'Saved locally · not synced · only visible to you',
    favoritesTherapists: 'Therapists',
    favoritesPractices: 'Practices',
    // Options
    optionsTitle: 'Options',
    optionsSubtitle: 'Settings & Information',
    languageOption: 'Language',
    privacyOption: 'Privacy',
    imprintOption: 'Imprint',
    appVersionOption: 'App Version',
    comingSoon: 'Coming soon',
    appearanceOption: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    logoutBtn: 'Log out',
    deleteAccount: 'Delete account',
    deleteAccountConfirmTitle: 'Delete account?',
    deleteAccountConfirmMsg: 'Your profile and all data will be permanently deleted. This action cannot be undone.',
    deleteAccountConfirmBtn: 'Delete permanently',
    myPractice: 'MY PRACTICE',
    managePractice: 'Manage',
    newPractice: 'Create new practice',
    linkPractice: 'Link practice',
    notLoggedIn: 'Not logged in',
    loginAction: 'Log in',
    // Practice / Therapist profile
    backBtn: 'Back',
    openInMaps: 'Open in Maps',
    distanceLabel: 'Distance',
    hoursLabel: 'Opening hours',
    addressLabel: 'Address',
    availabilityLabel: 'Office hours',
    insuranceLabel: 'Insurance',
    specsLabel: 'Specializations',
    certsLabel: 'Qualifications',
    aboutLabel: 'About',
    practicesLabel: 'Practice',
    therapistsLabel: 'Therapists',
    behandlungLabel: 'Treatment areas',
    detailsLabel: 'Details',
    // Location sheet
    locationTitle: 'Where are you searching?',
    locationSub: 'We need your location to find therapists near you.',
    useGPS: 'Use current location',
    gpsLoading: 'Detecting location …',
    locationDivider: 'or enter a city',
    confirmLocation: 'Continue',
  },
};

// ─── Autocomplete suggestions ─────────────────────────────────────────────────

const allSuggestions = [
  'Rückenschmerzen', 'Kniereha', 'Sportphysiotherapie', 'Schulterrehabilitation',
  'Nackenschmerzen', 'Hüftreha', 'Fußtherapie', 'Handtherapie',
  'Manualtherapie', 'Orthopädische Rehabilitation', 'Neurologische Rehabilitation',
  'Postoperative Reha', 'Lymphdrainage', 'Vojta-Therapie', 'Bobath-Therapie',
  'Kinesiotaping', 'Osteopathie', 'Dry Needling', 'Beckenbodentherapie',
  'Atemtherapie', 'Entspannungstherapie', 'Pädiatrische Physiotherapie',
  'Wirbelsäulentherapie', 'Triggerpunkt-Therapie', 'Geriatrische Rehabilitation',
  'Aquatherapie', 'Krankengymnastik', 'Rückentherapie', 'Physiotherapie'
];

// ─── Quick-chip labels ────────────────────────────────────────────────────────

const quickChips = [
  { label: 'Rückenschmerzen', keywords: ['rücken', 'rückenschmerzen', 'rückentherapie', 'wirbelsäule', 'wirbelsäulentherapie', 'haltung'] },
  { label: 'Kniereha',        keywords: ['knie', 'kniereha', 'knieschmerzen'] },
  { label: 'Sportphysiotherapie', keywords: ['sport', 'sportphysiotherapie', 'sportverletzung', 'sportreha'] },
  { label: 'Neurologische Rehabilitation', keywords: ['neurologie', 'neurologisch', 'neurologische rehabilitation', 'bobath', 'vojta', 'bobath-therapie', 'vojta-therapie'] },
  { label: 'Schulterrehabilitation', keywords: ['schulter', 'schulterrehabilitation', 'nackenschmerzen', 'nacken'] }
];

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const tabs = [
  { key: 'discover',  labelKey: 'tabSearch',     icon: '⌕' },
  { key: 'favorites', labelKey: 'tabFavorites',  icon: '♡' },
  { key: 'therapist', labelKey: 'tabTherapist',  icon: '＋' },
  { key: 'options',   labelKey: 'tabOptions',    icon: '☰' }
];

// ─── Filter options ───────────────────────────────────────────────────────────

const kassenartOptions = [
  { key: null,           label: 'Alle' },
  { key: 'gesetzlich',   label: 'Gesetzlich' },
  { key: 'privat',       label: 'Privat' },
  { key: 'selbstzahler', label: 'Selbstzahler' }
];

const fortbildungOptions = [
  { key: 'MT',     label: 'MT – Manuelle Therapie' },
  { key: 'Bobath', label: 'Neurologie (Bobath, PNF)' },
  { key: 'KGG',    label: 'KGG – Krankengymnastik am Gerät' },
  { key: 'MLD',    label: 'MLD – Manuelle Lymphdrainage' }
];

const regSpecOptions = [
  'Rückenschmerzen', 'Kniereha', 'Schulterrehabilitation', 'Nackenschmerzen', 'Hüftreha', 'Fußtherapie',
  'Sportphysiotherapie', 'Orthopädische Rehabilitation', 'Neurologische Rehabilitation',
  'Manualtherapie', 'Postoperative Reha', 'Lymphdrainage', 'Beckenbodentherapie',
  'Wirbelsäulentherapie', 'Handtherapie', 'Pädiatrische Physiotherapie',
  'Geriatrische Rehabilitation', 'Atemtherapie', 'Krankengymnastik',
  'Osteopathie', 'Kinesiotaping', 'Dry Needling', 'Triggerpunkt-Therapie',
  'Vojta-Therapie', 'Bobath-Therapie', 'Aquatherapie', 'Entspannungstherapie'
];
const languageOptions = ['DE', 'EN', 'TR', 'AR', 'FR', 'ES', 'IT', 'PL', 'RU'];
const REG_STEPS = 5;

// ─── Demo data ────────────────────────────────────────────────────────────────

const practices = [
  { id: 'p1',  name: 'Praxis RheinFit',        city: 'Köln-Innenstadt', address: 'Schildergasse 12, 50667 Köln',       phone: '+49 221 1234560', hours: 'Mo–Fr 8–18 Uhr, Sa 9–13 Uhr', lat: 50.9359, lng: 6.9519 },
  { id: 'p2',  name: 'PhysioZentrum Ehrenfeld', city: 'Köln-Ehrenfeld',  address: 'Venloer Str. 88, 50672 Köln',        phone: '+49 221 1234561', hours: 'Mo–Fr 7–19 Uhr',                lat: 50.9499, lng: 6.9226 },
  { id: 'p3',  name: 'Praxis am Dom',           city: 'Köln-Altstadt',   address: 'Domkloster 4, 50667 Köln',           phone: '+49 221 1234562', hours: 'Mo–Fr 8–17 Uhr',                lat: 50.9413, lng: 6.9583 },
  { id: 'p4',  name: 'Sportphysio Südstadt',    city: 'Köln-Südstadt',   address: 'Bonner Str. 55, 50677 Köln',         phone: '+49 221 1234563', hours: 'Mo–Sa 7–20 Uhr',                lat: 50.9218, lng: 6.9574 },
  { id: 'p5',  name: 'Praxis NordKöln',         city: 'Köln-Nippes',     address: 'Neusser Str. 210, 50733 Köln',       phone: '+49 221 1234564', hours: 'Mo–Fr 8–18 Uhr',                lat: 50.9711, lng: 6.9617 },
  { id: 'p6',  name: 'BewegungsArt Physio',     city: 'Köln-Sülz',       address: 'Berrenrather Str. 77, 50937 Köln',   phone: '+49 221 1234565', hours: 'Mo–Fr 9–18 Uhr, Sa 9–12 Uhr', lat: 50.9124, lng: 6.9273 },
  { id: 'p7',  name: 'Praxis Lindenthal',       city: 'Köln-Lindenthal', address: 'Dürener Str. 141, 50931 Köln',       phone: '+49 221 1234566', hours: 'Mo–Fr 8–19 Uhr',                lat: 50.9235, lng: 6.9045 },
  { id: 'p8',  name: 'RheinPhysio West',        city: 'Köln-Braunsfeld', address: 'Aachener Str. 300, 50933 Köln',      phone: '+49 221 1234567', hours: 'Mo–Fr 7–18 Uhr',                lat: 50.9358, lng: 6.8981 },
  { id: 'p9',  name: 'Sportmedizin Köln-Ost',   city: 'Köln-Mülheim',    address: 'Mülheimer Freiheit 5, 51063 Köln',   phone: '+49 221 1234568', hours: 'Mo–Fr 8–18 Uhr, Sa 9–13 Uhr', lat: 50.9622, lng: 6.9952 },
  { id: 'p10', name: 'Praxis Chorweiler',        city: 'Köln-Chorweiler', address: 'Pariser Platz 1, 50765 Köln',        phone: '+49 221 1234569', hours: 'Mo–Fr 9–17 Uhr',                lat: 51.0298, lng: 6.9302 }
];

const demoResults = [
  { id: 't1',  fullName: 'Anna Becker',       professionalTitle: 'Physiotherapeutin', specializations: ['Rückenschmerzen', 'Sportphysiotherapie'], languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['MT', 'KGG'],     photo: 'https://i.pravatar.cc/96?img=1',  practices: [practices[0]], verifiziert: true,  bio: 'Ich helfe Menschen, ihren Rücken dauerhaft zu entlasten – mit gezielter Therapie und bewegungsbasierter Prävention.', behandlungsbereiche: ['Orthopädische Rehabilitation', 'Sportphysiotherapie'], verfügbareZeiten: 'Mo–Fr 8–17 Uhr',          website: '' },
  { id: 't2',  fullName: 'Markus Stein',      professionalTitle: 'Physiotherapeut',   specializations: ['Neurologische Rehabilitation', 'Orthopädische Rehabilitation'], languages: ['DE'], homeVisit: false, kassenart: 'privat', fortbildungen: ['Bobath', 'MT'],  photo: 'https://i.pravatar.cc/96?img=3',  practices: [practices[0]], verifiziert: true,  bio: 'Mein Schwerpunkt liegt in der neurologischen Rehabilitation – von Schlaganfall bis MS.',                              behandlungsbereiche: ['Neurologische Rehabilitation', 'Orthopädische Rehabilitation'], verfügbareZeiten: 'Mo–Do 9–18 Uhr', website: 'www.markusstein-physio.de' },
  { id: 't3',  fullName: 'Julia Hoffmann',    professionalTitle: 'Physiotherapeutin', specializations: ['Kniereha', 'Sportphysiotherapie'],  languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['KGG'],           photo: 'https://i.pravatar.cc/96?img=5',  practices: [practices[1]], verifiziert: true,  bio: 'Spezialisiert auf Knie- und Sportverletzungen – ich begleite dich von der Diagnose bis zurück in den Sport.',         behandlungsbereiche: ['Sportphysiotherapie', 'Orthopädische Rehabilitation'], verfügbareZeiten: 'Mo–Fr 7–16 Uhr', website: '' },
  { id: 't4',  fullName: 'Thomas Müller',     professionalTitle: 'Physiotherapeut',   specializations: ['Wirbelsäulentherapie', 'Manualtherapie'], languages: ['DE'],  homeVisit: false, kassenart: 'gesetzlich',   fortbildungen: ['MT', 'MLD'],     photo: 'https://i.pravatar.cc/96?img=7',  practices: [practices[1]], verifiziert: true,  bio: 'Manuelle Therapie ist meine Leidenschaft – ich behandle komplexe Wirbelsäulenbeschwerden mit Präzision.',             behandlungsbereiche: ['Orthopädische Rehabilitation', 'Manualtherapie'], verfügbareZeiten: 'Di–Sa 8–18 Uhr', website: '' },
  { id: 't5',  fullName: 'Sarah Schneider',   professionalTitle: 'Physiotherapeutin', specializations: ['Schulterrehabilitation', 'Nackenschmerzen'], languages: ['DE', 'TR'], homeVisit: false, kassenart: 'selbstzahler', fortbildungen: ['MT'], photo: 'https://i.pravatar.cc/96?img=9',  practices: [practices[2]], verifiziert: true,  bio: 'Schulter- und Nackenbeschwerden sind mein Spezialgebiet – auch für Patienten, die bisher keine Besserung erfahren haben.', behandlungsbereiche: ['Orthopädische Rehabilitation'], verfügbareZeiten: 'Mo–Fr 10–19 Uhr', website: '' },
  { id: 't6',  fullName: 'Felix Wagner',      professionalTitle: 'Physiotherapeut',   specializations: ['Sportphysiotherapie', 'Hüftreha'],  languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['KGG', 'MT'],     photo: 'https://i.pravatar.cc/96?img=11', practices: [practices[2]], verifiziert: true,  bio: 'Als ehemaliger Leistungssportler kenne ich Sportverletzungen aus erster Hand und behandle sie mit Verständnis.',       behandlungsbereiche: ['Sportphysiotherapie', 'Orthopädische Rehabilitation'], verfügbareZeiten: 'Mo–Sa 7–20 Uhr', website: 'www.felix-sportphysio.de' },
  { id: 't7',  fullName: 'Laura Fischer',     professionalTitle: 'Physiotherapeutin', specializations: ['Neurologische Rehabilitation', 'Bobath-Therapie'], languages: ['DE'], homeVisit: true, kassenart: 'privat', fortbildungen: ['Bobath', 'MLD'], photo: 'https://i.pravatar.cc/96?img=13', practices: [practices[3]], verifiziert: true,  bio: 'Ich begleite Schlaganfall-Patienten und Menschen mit neurologischen Erkrankungen auf dem Weg zu mehr Selbstständigkeit.', behandlungsbereiche: ['Neurologische Rehabilitation'], verfügbareZeiten: 'Mo–Fr 8–16 Uhr', website: '' },
  { id: 't8',  fullName: 'David Weber',       professionalTitle: 'Physiotherapeut',   specializations: ['Rückenschmerzen', 'Beckenbodentherapie'], languages: ['DE', 'FR'], homeVisit: false, kassenart: 'gesetzlich', fortbildungen: ['MLD', 'KGG'], photo: 'https://i.pravatar.cc/96?img=15', practices: [practices[3]], verifiziert: true,  bio: 'Rücken- und Beckenbodentherapie – ich behandle ganzheitlich und erkläre dir, was in deinem Körper passiert.',          behandlungsbereiche: ['Orthopädische Rehabilitation', 'Beckenbodentherapie'], verfügbareZeiten: 'Mo–Do 8–18 Uhr', website: '' },
  { id: 't9',  fullName: 'Nina Schäfer',      professionalTitle: 'Physiotherapeutin', specializations: ['Pädiatrische Physiotherapie', 'Vojta-Therapie'], languages: ['DE', 'EN'], homeVisit: true, kassenart: 'gesetzlich', fortbildungen: ['Bobath'], photo: 'https://i.pravatar.cc/96?img=17', practices: [practices[4]], verifiziert: true,  bio: 'Kinder brauchen eine andere Therapie als Erwachsene – ich bin auf pädiatrische Physiotherapie spezialisiert.',         behandlungsbereiche: ['Pädiatrische Physiotherapie', 'Neurologische Rehabilitation'], verfügbareZeiten: 'Mo–Fr 8–15 Uhr', website: '' },
  { id: 't10', fullName: 'Leon Meyer',        professionalTitle: 'Physiotherapeut',   specializations: ['Orthopädische Rehabilitation', 'Postoperative Reha'], languages: ['DE'], homeVisit: false, kassenart: 'selbstzahler', fortbildungen: ['MT', 'KGG'], photo: 'https://i.pravatar.cc/96?img=19', practices: [practices[4]], verifiziert: true,  bio: 'Postoperative Rehabilitation ist mein Schwerpunkt – ich begleite dich sicher zurück in deinen Alltag.',               behandlungsbereiche: ['Orthopädische Rehabilitation', 'Postoperative Reha'], verfügbareZeiten: 'Di–Sa 9–18 Uhr', website: 'www.leon-physio.de' },
  { id: 't11', fullName: 'Lena Braun',        professionalTitle: 'Physiotherapeutin', specializations: ['Wirbelsäule', 'Haltung'],           languages: ['DE', 'EN'], homeVisit: false, kassenart: 'gesetzlich',   fortbildungen: ['MT'],            photo: 'https://i.pravatar.cc/96?img=21', practices: [practices[5]], verifiziert: true,  bio: 'Haltungsanalyse und Wirbelsäulentherapie – ich helfe dir, die Ursachen chronischer Beschwerden zu verstehen.',        behandlungsbereiche: ['Orthopädie', 'Prävention'],           verfügbareZeiten: 'Mo–Fr 9–18 Uhr',          website: '' },
  { id: 't12', fullName: 'Jonas Richter',     professionalTitle: 'Physiotherapeut',   specializations: ['Knie', 'Laufen'],                   languages: ['DE'],       homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['KGG', 'MT'],     photo: 'https://i.pravatar.cc/96?img=23', practices: [practices[5]], verifiziert: true,  bio: 'Laufsportler und Kniepatienten sind meine Kernzielgruppe – ich bringe dich wieder auf die Strecke.',                  behandlungsbereiche: ['Sportphysio', 'Orthopädie'],          verfügbareZeiten: 'Mo–Sa 7–19 Uhr',          website: '' },
  { id: 't13', fullName: 'Marie König',       professionalTitle: 'Physiotherapeutin', specializations: ['Schulter', 'Arm', 'Hand'],          languages: ['DE', 'EN'], homeVisit: false, kassenart: 'privat',       fortbildungen: ['MT', 'MLD'],     photo: 'https://i.pravatar.cc/96?img=25', practices: [practices[6]], verifiziert: true,  bio: 'Schulter, Arm und Hand – ich bin auf die obere Extremität spezialisiert und behandle auch komplexe Fälle.',            behandlungsbereiche: ['Orthopädie', 'Manuelle Therapie'],    verfügbareZeiten: 'Mo–Fr 8–17 Uhr',          website: '' },
  { id: 't14', fullName: 'Ben Schmidt',       professionalTitle: 'Physiotherapeut',   specializations: ['Sport', 'Muskeln'],                 languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['KGG'],           photo: 'https://i.pravatar.cc/96?img=27', practices: [practices[6]], verifiziert: true,  bio: 'Muskelaufbau, Verletzungsprävention und Sportphysio – ich unterstütze Sportler aller Leistungsstufen.',               behandlungsbereiche: ['Sportphysio'],                        verfügbareZeiten: 'Mo–Fr 10–20 Uhr, Sa 9–14 Uhr', website: 'www.ben-sportphysio.de' },
  { id: 't15', fullName: 'Sophia Wolf',       professionalTitle: 'Physiotherapeutin', specializations: ['Neurologie', 'MS', 'Parkinson'],    languages: ['DE'],       homeVisit: true,  kassenart: 'privat',       fortbildungen: ['Bobath', 'MLD'], photo: 'https://i.pravatar.cc/96?img=29', practices: [practices[7]], verifiziert: true,  bio: 'MS, Parkinson und neurologische Erkrankungen – ich begleite meine Patienten mit viel Empathie und Fachkompetenz.',     behandlungsbereiche: ['Neurologie'],                         verfügbareZeiten: 'Mo–Fr 8–16 Uhr',          website: '' },
  { id: 't16', fullName: 'Niklas Zimmermann', professionalTitle: 'Physiotherapeut',   specializations: ['Rücken', 'Ergonomie'],              languages: ['DE', 'EN'], homeVisit: false, kassenart: 'selbstzahler', fortbildungen: ['MT', 'KGG'],     photo: 'https://i.pravatar.cc/96?img=31', practices: [practices[7]], verifiziert: true,  bio: 'Ergonomieberatung und Rückentherapie – ich helfe Büroangestellten, Schmerzen am Arbeitsplatz dauerhaft zu lösen.',     behandlungsbereiche: ['Orthopädie', 'Prävention'],           verfügbareZeiten: 'Di–Sa 9–19 Uhr',          website: 'www.niklas-ergo.de' },
  { id: 't17', fullName: 'Hanna Krause',      professionalTitle: 'Physiotherapeutin', specializations: ['Sportreha', 'Fußball', 'Laufen'],   languages: ['DE'],       homeVisit: false, kassenart: 'gesetzlich',   fortbildungen: ['KGG'],           photo: 'https://i.pravatar.cc/96?img=33', practices: [practices[8]], verifiziert: true,  bio: 'Fußball und Laufen sind meine Sportarten – ich behandle Sportler mit Leidenschaft und evidenzbasierter Therapie.',     behandlungsbereiche: ['Sportphysio'],                        verfügbareZeiten: 'Mo–Fr 7–18 Uhr',          website: '' },
  { id: 't18', fullName: 'Elias Schulz',      professionalTitle: 'Physiotherapeut',   specializations: ['Knieschmerzen', 'Hüfte', 'Fuß'],   languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['MT', 'KGG'],     photo: 'https://i.pravatar.cc/96?img=35', practices: [practices[8]], verifiziert: true,  bio: 'Untere Extremitäten sind mein Fachgebiet – vom Knie über die Hüfte bis zum Fuß behandle ich ganzheitlich.',           behandlungsbereiche: ['Orthopädie', 'Sportphysio'],          verfügbareZeiten: 'Mo–Sa 8–20 Uhr',          website: '' },
  { id: 't19', fullName: 'Mia Hartmann',      professionalTitle: 'Physiotherapeutin', specializations: ['Schwangerschaft', 'Beckenboden'],   languages: ['DE', 'AR'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['MLD', 'Bobath'], photo: 'https://i.pravatar.cc/96?img=37', practices: [practices[9]], verifiziert: true,  bio: 'Schwangerschaft, Geburtsvorbereitung und Rückbildung – ich begleite Frauen in jeder Phase mit einfühlsamer Therapie.', behandlungsbereiche: ['Beckengesundheit', 'Pädiatrie'],      verfügbareZeiten: 'Mo–Fr 9–17 Uhr',          website: '' },
  { id: 't20', fullName: 'Lukas Neumann',     professionalTitle: 'Physiotherapeut',   specializations: ['Wirbelsäule', 'Bandscheibe'],       languages: ['DE'],       homeVisit: false, kassenart: 'privat',       fortbildungen: ['MT', 'MLD'],     photo: 'https://i.pravatar.cc/96?img=39', practices: [practices[9]], verifiziert: true,  bio: 'Bandscheibenvorfälle und Wirbelkanalverengungen – ich behandle auch komplexe Wirbelsäulendiagnosen konservativ.',      behandlungsbereiche: ['Orthopädie', 'Manuelle Therapie'],    verfügbareZeiten: 'Mo–Fr 8–18 Uhr',          website: '' }
];

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const getBaseUrl = () => BASE_URL;

// ─── Map API therapist → UI format ────────────────────────────────────────────

const parseStringOrArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
  return [];
};

const mapApiTherapist = (t) => ({
  id: t.id,
  fullName: t.fullName,
  professionalTitle: t.professionalTitle,
  specializations: parseStringOrArray(t.specializations),
  languages: parseStringOrArray(t.languages).map(l => l.toUpperCase()),
  homeVisit: t.homeVisit ?? false,
  isVisible: t.isVisible ?? true,
  availability: t.availability ?? '',
  city: t.city ?? '',
  bio: t.bio ?? '',
  kassenart: t.kassenart ?? null,
  fortbildungen: parseStringOrArray(t.certifications),
  verifiziert: true,
  behandlungsbereiche: parseStringOrArray(t.specializations),
  verfügbareZeiten: '',
  website: '',
  photo: t.photo || `https://i.pravatar.cc/96?u=${t.id}`,
  practices: (t.practices ?? []).map(p => ({
    id: p.id,
    name: p.name,
    city: p.city,
    address: p.address ?? '',
    phone: p.phone ?? '',
    hours: p.hours ?? '',
    description: p.description ?? '',
    lat: p.lat,
    lng: p.lng,
    logo: p.logo ?? null,
    photos: p.photos ?? [],
  })),
});

// ─── Distance helper (Haversine, returns km) ─────────────────────────────────

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDist = (km) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

// ─── App ──────────────────────────────────────────────────────────────────────

function callPhone(phone) {
  if (!phone) {
    Alert.alert('Keine Nummer', 'Für diesen Therapeuten ist keine Telefonnummer hinterlegt.');
    return;
  }
  Alert.alert(phone, 'Jetzt anrufen?', [
    { text: 'Anrufen', onPress: () => Linking.openURL(`tel:${phone}`) },
    { text: 'Abbrechen', style: 'cancel' },
  ]);
}

export default function App() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('system'); // 'light' | 'dark' | 'system'
  const scheme = themeMode === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : themeMode;
  const c = palette[scheme];

  const [appLanguage, setAppLanguage] = useState('de'); // 'de' | 'en'
  const t = (key) => translations[appLanguage]?.[key] ?? translations['de'][key];

  const [activeTab, setActiveTab] = useState('discover');
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [selectedPracticeTherapists, setSelectedPracticeTherapists] = useState([]);
  const [selectedPracticeLoading, setSelectedPracticeLoading] = useState(false);
  const [selectedPracticeError, setSelectedPracticeError] = useState('');
  const [selectedTherapist, setSelectedTherapist] = useState(null);

  // Favorites — stored locally on device only
  const [favorites, setFavorites] = useState([]);
  useEffect(() => {
    AsyncStorage.getItem('revio_favorites').then(val => {
      if (val) setFavorites(JSON.parse(val));
    });
  }, []);
  const toggleFavorite = (therapist) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === therapist.id);
      const next = exists ? prev.filter(f => f.id !== therapist.id) : [...prev, therapist];
      AsyncStorage.setItem('revio_favorites', JSON.stringify(next));
      return next;
    });
  };
  const isFavorite = (id) => favorites.some(f => f.id === id);

  // Practice favorites — stored locally
  const [favoritePractices, setFavoritePractices] = useState([]);
  useEffect(() => {
    AsyncStorage.getItem('revio_fav_practices').then(val => {
      if (val) setFavoritePractices(JSON.parse(val));
    });
  }, []);
  const toggleFavoritePractice = (practice) => {
    // Store only practice metadata — therapists are always fetched live via openPractice()
    const { therapists: _drop, ...practiceData } = practice;
    setFavoritePractices(prev => {
      const exists = prev.some(f => f.id === practice.id);
      const next = exists ? prev.filter(f => f.id !== practice.id) : [...prev, practiceData];
      AsyncStorage.setItem('revio_fav_practices', JSON.stringify(next));
      return next;
    });
  };
  const isPracticeFavorite = (id) => favoritePractices.some(f => f.id === id);

  // Registration state
  const [showRegister, setShowRegister] = useState(false);
  const [regStep, setRegStep] = useState(1);
  const [regSubmitted, setRegSubmitted] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regSpecializations, setRegSpecializations] = useState([]);
  const [regLanguages, setRegLanguages] = useState([]);
  const [regHomeVisit, setRegHomeVisit] = useState(false);
  const [regFortbildungen, setRegFortbildungen] = useState([]);
  const [regPracticeName, setRegPracticeName] = useState('');
  const [regPracticeAddress, setRegPracticeAddress] = useState('');
  const [regPracticeCity, setRegPracticeCity] = useState('');
  const [regPracticePhone, setRegPracticePhone] = useState('');

  const toggleRegSpec = (s) => setRegSpecializations(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleRegLang = (l) => setRegLanguages(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleRegFort = (f) => setRegFortbildungen(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  const [regCustomLanguage, setRegCustomLanguage] = useState('');
  const [regPracticeMode, setRegPracticeMode] = useState('new'); // 'new' | 'existing' | 'skip'
  const [regExistingPracticeName, setRegExistingPracticeName] = useState('');
  const [regExistingPracticeId, setRegExistingPracticeId] = useState(null);
  const [regPracticeSearchResults, setRegPracticeSearchResults] = useState([]);
  const [regPracticeSearching, setRegPracticeSearching] = useState(false);

  // Auth state
  const [authToken, setAuthToken] = useState(null);
  const [loggedInTherapist, setLoggedInTherapist] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editSpecializations, setEditSpecializations] = useState('');
  const [editLanguages, setEditLanguages] = useState('');
  const [editHomeVisit, setEditHomeVisit] = useState(false);
  const [editIsVisible, setEditIsVisible] = useState(true);
  const [editAvailability, setEditAvailability] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Practice management state
  const [showCreatePractice, setShowCreatePractice] = useState(false);
  const [showPracticeSearch, setShowPracticeSearch] = useState(false);
  const [showPracticeAdmin, setShowPracticeAdmin] = useState(false);
  const [scrollToInvite, setScrollToInvite] = useState(false);
  const practiceAdminScrollRef = React.useRef(null);
  const inviteSectionY = React.useRef(0);
  const [showInvitePage, setShowInvitePage] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState([]);
  const [inviteSearchLoading, setInviteSearchLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteTokenLoading, setInviteTokenLoading] = useState(false);
  // therapistId → linkId for pending (PROPOSED) invites
  const [pendingInvites, setPendingInvites] = useState({});
  // Full therapist data for displaying the pending list
  const [pendingTherapistsList, setPendingTherapistsList] = useState([]);
  const inviteSearchDebounce = React.useRef(null);
  const [adminPracticeDetail, setAdminPracticeDetail] = useState(null);
  const [createPracticeName, setCreatePracticeName] = useState('');
  const [createPracticeCity, setCreatePracticeCity] = useState('');
  const [createPracticeAddress, setCreatePracticeAddress] = useState('');
  const [createPracticePhone, setCreatePracticePhone] = useState('');
  const [createPracticeHours, setCreatePracticeHours] = useState('');
  const [createPracticeLoading, setCreatePracticeLoading] = useState(false);
  const [practiceSearchQuery, setPracticeSearchQuery] = useState('');
  const [practiceSearchResults, setPracticeSearchResults] = useState([]);
  const [practiceSearchLoading, setPracticeSearchLoading] = useState(false);
  const [editPracticeName, setEditPracticeName] = useState('');
  const [editPracticeCity, setEditPracticeCity] = useState('');
  const [editPracticeAddress, setEditPracticeAddress] = useState('');
  const [editPracticePhone, setEditPracticePhone] = useState('');
  const [editPracticeHours, setEditPracticeHours] = useState('');
  const [editPracticeDescription, setEditPracticeDescription] = useState('');
  const [practiceEditSaving, setPracticeEditSaving] = useState(false);
  const [editPracticeLogo, setEditPracticeLogo] = useState(null);
  const [editPracticePhotos, setEditPracticePhotos] = useState([]);

  // Create-therapist-profile form state (practice admin)
  const [invitePageTab, setInvitePageTab] = useState('link'); // 'new' | 'link'
  const [createTherapistName, setCreateTherapistName] = useState('');
  const [createTherapistEmail, setCreateTherapistEmail] = useState('');
  const [createTherapistTitle, setCreateTherapistTitle] = useState('');
  const [createTherapistLoading, setCreateTherapistLoading] = useState(false);
  const [createTherapistError, setCreateTherapistError] = useState('');

  // Invite claim flow state
  const [showInviteClaim, setShowInviteClaim] = useState(false);
  const [inviteClaimToken, setInviteClaimToken] = useState(null);
  const [inviteClaimData, setInviteClaimData] = useState(null); // { therapist, practice }
  const [inviteClaimLoading, setInviteClaimLoading] = useState(false);
  const [inviteClaimError, setInviteClaimError] = useState('');
  const [inviteClaimPassword, setInviteClaimPassword] = useState('');
  const [inviteClaimPasswordConfirm, setInviteClaimPasswordConfirm] = useState('');
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('revio_auth_token').then(async (token) => {
      if (!token) return;
      try {
        const res = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setAuthToken(token);
          setLoggedInTherapist(await res.json());
        } else {
          AsyncStorage.removeItem('revio_auth_token');
        }
      } catch {}
    });
  }, []);

  // Deep-link / initial URL handling for invite token
  useEffect(() => {
    const handleUrl = async (url) => {
      if (!url) return;
      try {
        const match = url.match(/[?&]token=([^&]+)/);
        if (!match) return;
        const token = decodeURIComponent(match[1]);
        setInviteClaimLoading(true);
        setInviteClaimError('');
        try {
          const res = await fetch(`${getBaseUrl()}/invite/validate?token=${encodeURIComponent(token)}`);
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setInviteClaimError(err.message ?? 'Ungültige Einladung');
            setShowInviteClaim(true);
            return;
          }
          const data = await res.json();
          setInviteClaimToken(token);
          setInviteClaimData(data);
          setInviteClaimPassword('');
          setInviteClaimPasswordConfirm('');
          setInviteClaimError('');
          setShowInviteClaim(true);
        } catch {
          setInviteClaimError('Verbindungsfehler beim Validieren der Einladung.');
          setShowInviteClaim(true);
        } finally {
          setInviteClaimLoading(false);
        }
      } catch {}
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, []);

  // Poll notifications every 30s when logged in
  useEffect(() => {
    if (notificationPollRef.current) clearInterval(notificationPollRef.current);
    if (!authToken) { setNotifications([]); return; }
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/notifications`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications ?? []);
        }
      } catch {}
    };
    fetchNotifications();
    notificationPollRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(notificationPollRef.current);
  }, [authToken]);

  const handleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoginError(err.message ?? 'Ungültige Zugangsdaten');
        return;
      }
      const data = await res.json();
      await AsyncStorage.setItem('revio_auth_token', data.token);
      setAuthToken(data.token);
      const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      if (profileRes.ok) setLoggedInTherapist(await profileRes.json());
      setShowLogin(false);
      setLoginEmail('');
      setLoginPassword('');
    } catch {
      setLoginError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    if (authToken) {
      await fetch(`${getBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
      await AsyncStorage.removeItem('revio_auth_token');
    }
    setAuthToken(null);
    setLoggedInTherapist(null);
  };

  const deleteAccountConfirmed = async () => {
    try {
      await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    } catch {}
    await AsyncStorage.removeItem('revio_auth_token');
    setAuthToken(null);
    setLoggedInTherapist(null);
  };

  const handleDeleteAccount = () => {
    if (loggedInTherapist?.adminPractice) {
      const msg = `Du bist Admin von „${loggedInTherapist.adminPractice.name}". Bitte lösche zuerst die Praxis, bevor du dein Konto löschst.`;
      if (Platform.OS === 'web') { window.alert(`Praxis zuerst löschen\n\n${msg}`); }
      else { Alert.alert('Praxis zuerst löschen', msg, [{ text: 'OK' }]); }
      return;
    }
    const msg = t('deleteAccountConfirmMsg');
    if (Platform.OS === 'web') {
      if (window.confirm(`${t('deleteAccountConfirmTitle')}\n\n${msg}`)) deleteAccountConfirmed();
    } else {
      Alert.alert(t('deleteAccountConfirmTitle'), msg, [
        { text: t('cancelBtn') ?? 'Abbrechen', style: 'cancel' },
        { text: t('deleteAccountConfirmBtn'), style: 'destructive', onPress: deleteAccountConfirmed },
      ]);
    }
  };

  const deletePracticeConfirmed = async () => {
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        setShowPracticeAdmin(false);
        setAdminPracticeDetail(null);
        const meRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (meRes.ok) setLoggedInTherapist(await meRes.json());
      }
    } catch {}
  };

  const handleDeletePractice = () => {
    const practiceName = loggedInTherapist?.adminPractice?.name ?? 'diese Praxis';
    const msg = `„${practiceName}" wird dauerhaft gelöscht. Alle verknüpften Therapeuten werden getrennt. Diese Aktion kann nicht rückgängig gemacht werden.`;
    if (Platform.OS === 'web') {
      if (window.confirm(`Praxis löschen?\n\n${msg}`)) deletePracticeConfirmed();
    } else {
      Alert.alert('Praxis löschen', msg, [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Endgültig löschen', style: 'destructive', onPress: deletePracticeConfirmed },
      ]);
    }
  };

  const handleSaveProfile = async () => {
    if (!authToken) return;
    setProfileSaving(true);
    try {
      const res = await fetch(`${getBaseUrl()}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          bio: editBio,
          specializations: editSpecializations.split(',').map(s => s.trim()).filter(Boolean),
          languages: editLanguages.split(',').map(s => s.trim()).filter(Boolean),
          homeVisit: editHomeVisit,
          isVisible: editIsVisible,
          availability: editAvailability,
        }),
      });
      if (res.ok) {
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (profileRes.ok) setLoggedInTherapist(await profileRes.json());
        setEditMode(false);
        Alert.alert('Gespeichert', 'Dein Profil wurde erfolgreich aktualisiert.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Profil konnte nicht gespeichert werden.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    }
    setProfileSaving(false);
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const filename = uri.split('/').pop() || 'photo.jpg';
    const mimeType = asset.mimeType || 'image/jpeg';
    try {
      const formData = new FormData();
      formData.append('photo', { uri, name: filename, type: mimeType });
      const uploadRes = await fetch(`${getBaseUrl()}/upload/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      if (uploadRes.ok) {
        const { url } = await uploadRes.json();
        const fullUrl = `${getBaseUrl()}${url}`;
        setLoggedInTherapist(prev => ({ ...prev, photo: fullUrl }));
        Alert.alert('Erfolg', 'Profilbild gespeichert.');
      } else {
        const status = uploadRes.status;
        Alert.alert('Fehler', `Foto konnte nicht hochgeladen werden (${status}).`);
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    }
  };

  // Practice: create new practice
  const handleCreatePractice = async () => {
    if (!authToken || !createPracticeName.trim() || !createPracticeCity.trim()) {
      Alert.alert('Fehlende Angaben', 'Name und Stadt sind Pflichtfelder.');
      return;
    }
    setCreatePracticeLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: createPracticeName.trim(),
          city: createPracticeCity.trim(),
          address: createPracticeAddress.trim() || undefined,
          phone: createPracticePhone.trim() || undefined,
          hours: createPracticeHours.trim() || undefined,
        }),
      });
      if (res.ok) {
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (profileRes.ok) setLoggedInTherapist(await profileRes.json());
        setCreatePracticeName(''); setCreatePracticeCity('');
        setCreatePracticeAddress(''); setCreatePracticePhone(''); setCreatePracticeHours('');
        setShowCreatePractice(false);
        Alert.alert('Praxis erstellt', 'Deine Praxis wurde erfolgreich erstellt.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Praxis konnte nicht erstellt werden.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setCreatePracticeLoading(false);
    }
  };

  // Practice: search practices
  const handleSearchPractices = async () => {
    setPracticeSearchLoading(true);
    try {
      const res = await fetch(
        `${getBaseUrl()}/practice/search?q=${encodeURIComponent(practiceSearchQuery)}`,
        { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} },
      );
      if (res.ok) setPracticeSearchResults((await res.json()).practices ?? []);
    } catch {}
    finally { setPracticeSearchLoading(false); }
  };

  // Practice: send connection request
  const handleConnectToPractice = async (practiceId) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/practice/${practiceId}/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        Alert.alert('Anfrage gesendet', 'Deine Verbindungsanfrage wurde gesendet. Die Praxis muss sie bestätigen.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Hinweis', err.message ?? 'Anfrage konnte nicht gesendet werden.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    }
  };

  // Practice: load full admin practice detail
  const openTherapistById = async (therapistId) => {
    try {
      const res = await fetch(`${getBaseUrl()}/therapist/${therapistId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTherapist(mapApiTherapist(data.therapist));
      }
    } catch {}
  };

  const loadAdminPracticeDetail = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setAdminPracticeDetail((await res.json()).practice);
    } catch {}
  };

  // Practice: accept/reject connection request
  const handleLinkAction = async (linkId, action) => {
    if (!authToken) return;
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice/links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await loadAdminPracticeDetail();
    } catch {}
  };

  // Practice: create new therapist profile and send invitation
  const handleCreateTherapist = async () => {
    if (!createTherapistName.trim() || !createTherapistEmail.trim() || !createTherapistTitle.trim()) {
      setCreateTherapistError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    setCreateTherapistLoading(true);
    setCreateTherapistError('');
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice/create-therapist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          fullName: createTherapistName.trim(),
          email: createTherapistEmail.trim(),
          professionalTitle: createTherapistTitle.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCreateTherapistName('');
        setCreateTherapistEmail('');
        setCreateTherapistTitle('');
        setCreateTherapistError('');
        Alert.alert('Profil erstellt', 'Eine Einladungs-E-Mail wurde verschickt.');
        await loadAdminPracticeDetail();
      } else {
        setCreateTherapistError(data.message ?? 'Profil konnte nicht erstellt werden.');
      }
    } catch {
      setCreateTherapistError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
    } finally {
      setCreateTherapistLoading(false);
    }
  };

  // Practice: resend invitation to an invited therapist
  const handleResendInvite = async (therapistId) => {
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice/resend-invite/${therapistId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        Alert.alert('Einladung erneut gesendet', 'Eine neue Einladungs-E-Mail wurde verschickt.');
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Einladung konnte nicht erneut gesendet werden.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    }
  };

  // Invite page: search therapists
  const handleInviteSearch = (text) => {
    setInviteSearchQuery(text);
    setInviteSearchResults([]);
    if (inviteSearchDebounce.current) clearTimeout(inviteSearchDebounce.current);
    if (text.length < 2) return;
    inviteSearchDebounce.current = setTimeout(async () => {
      setInviteSearchLoading(true);
      try {
        const res = await fetch(`${getBaseUrl()}/therapists/search?q=${encodeURIComponent(text)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        setInviteSearchResults(data.therapists ?? []);
      } catch {}
      setInviteSearchLoading(false);
    }, 350);
  };

  const handleInviteBySearch = async (therapist) => {
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ email: therapist.email }),
      });
      if (res.ok || res.status === 409) {
        const data = res.ok ? await res.json() : {};
        const linkId = data.link?.id ?? true;
        setPendingInvites(prev => ({ ...prev, [therapist.id]: linkId }));
        setPendingTherapistsList(prev =>
          prev.find(t => t.id === therapist.id) ? prev : [...prev, { ...therapist, linkId }]
        );
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Einladung fehlgeschlagen.');
      }
    } catch {
      Alert.alert('Verbindungsfehler');
    }
  };

  const handleCancelInvite = (therapistId, therapistName) => {
    const doCancel = async () => {
      try {
        const res = await fetch(`${getBaseUrl()}/my/practice/invite/${therapistId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.ok) {
          setPendingInvites(prev => {
            const next = { ...prev };
            delete next[therapistId];
            return next;
          });
          setPendingTherapistsList(prev => prev.filter(t => t.id !== therapistId));
        } else {
          Alert.alert('Fehler', 'Einladung konnte nicht zurückgezogen werden.');
        }
      } catch {
        Alert.alert('Verbindungsfehler');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Einladung an ${therapistName} zurückziehen?`)) doCancel();
    } else {
      Alert.alert(
        'Einladung zurückziehen',
        `Möchtest du die Einladung an ${therapistName} zurückziehen?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Zurückziehen', style: 'destructive', onPress: doCancel },
        ]
      );
    }
  };

  const handleLoadInviteToken = async () => {
    setInviteTokenLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/my/practice/invite-token`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setInviteToken(data);
    } catch {}
    setInviteTokenLoading(false);
  };

  const handleShareInviteLink = async () => {
    const link = `https://revio.app/join/${inviteToken.token}`;
    const message = `Du wurdest eingeladen, der Praxis „${inviteToken.practiceName}" auf Revio beizutreten:\n${link}`;
    try {
      await Share.share({ message, url: link, title: 'Revio – Einladung' });
    } catch {}
  };

  // Practice: save edited practice data
  const handleSavePractice = async () => {
    if (!authToken) return;
    setPracticeEditSaving(true);
    try {
      const body = {};
      if (editPracticeName.trim()) body.name = editPracticeName.trim();
      if (editPracticeCity.trim()) body.city = editPracticeCity.trim();
      if (editPracticeAddress.trim() !== undefined) body.address = editPracticeAddress.trim();
      if (editPracticePhone.trim() !== undefined) body.phone = editPracticePhone.trim();
      if (editPracticeHours.trim() !== undefined) body.hours = editPracticeHours.trim();
      body.description = editPracticeDescription.trim();
      if (editPracticeLogo !== null) body.logo = editPracticeLogo;
      if (editPracticePhotos.length > 0) body.photos = JSON.stringify(editPracticePhotos);

      const res = await fetch(`${getBaseUrl()}/my/practice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        Alert.alert('Gespeichert', 'Praxisdaten wurden aktualisiert.');
        await loadAdminPracticeDetail();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Fehler', err.message ?? 'Speichern fehlgeschlagen.');
      }
    } catch {
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setPracticeEditSaving(false);
    }
  };

  // Practice: pick logo
  const handlePickPracticeLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Kein Zugriff', 'Bitte Fotobibliothek erlauben.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setEditPracticeLogo(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  // Practice: add a photo
  const handleAddPracticePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Kein Zugriff', 'Bitte Fotobibliothek erlauben.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.4, base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setEditPracticePhotos(prev => [...prev, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  // GPS: request on demand only
  const handleGetLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Standort nicht verfügbar', 'Bitte erlaube den Standortzugriff in den Einstellungen.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      if (geo?.city) {
        const streetParts = [geo.street, geo.streetNumber].filter(Boolean).join(' ');
        const label = streetParts ? `${streetParts}, ${geo.city}` : geo.city;
        setCity(geo.city);
        setLocationLabel(label);
        AsyncStorage.setItem('savedCity', geo.city);
        AsyncStorage.setItem('savedLocationLabel', label);
      }
      setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      AsyncStorage.setItem('savedCoords', JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude }));
    } catch {
      Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
    }
  };

  // Search state
  const [query, setQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeChip, setActiveChip] = useState(null);
  const [city, setCity] = useState('');
  const [userCoords, setUserCoords] = useState(null);
  const [homeVisit, setHomeVisit] = useState(false);
  const [kassenart, setKassenart] = useState(null);
  const [fortbildungen, setFortbildungen] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allApiTherapists, setAllApiTherapists] = useState([]);

  const [searched, setSearched] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationPollRef = React.useRef(null);
  const [locationLabel, setLocationLabel] = useState(''); // display: "Hauptstraße 5, München"
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [pendingQuery, setPendingQuery] = useState(null);
  const [locationSheetCity, setLocationSheetCity] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const locationDebounceRef = React.useRef(null);
  const pendingGPSResult = React.useRef(null); // stores { city, coords, label } from GPS detection

  // Autocomplete: suggestions matching current input
  const acSuggestions = query.length >= 2
    ? allSuggestions.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  const activeFilterCount = (homeVisit ? 1 : 0) + (kassenart ? 1 : 0) + fortbildungen.length;

  const toggleFortbildung = (key) => {
    setFortbildungen(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Auto-refresh search when filters change (only if a search has already been run)
  const searchedRef = React.useRef(false);
  useEffect(() => { searchedRef.current = searched; }, [searched]);
  useEffect(() => {
    if (!searchedRef.current) return;
    runSearchWith(query, userCoords);
  }, [homeVisit, kassenart, fortbildungen]);

  const applyFilters = (list) => {
    return list.filter(t => {
      if (homeVisit && !t.homeVisit) return false;
      if (kassenart && t.kassenart && t.kassenart !== kassenart) return false;
      if (fortbildungen.length > 0) {
        const certs = t.fortbildungen ?? t.certifications ?? [];
        if (!fortbildungen.some(f => certs.includes(f))) return false;
      }
      return true;
    });
  };

  const withDistances = (list, coords) => {
    if (!coords) return list;
    return list
      .map(t => {
        const p = t.practices?.[0];
        if (!p?.lat) return { ...t, distKm: null };
        return { ...t, distKm: haversine(coords.lat, coords.lng, p.lat, p.lng) };
      })
      .sort((a, b) => (a.distKm ?? 9999) - (b.distKm ?? 9999));
  };

  const runSearchWith = async (q, coords, cityOverride) => {
    const effectiveCity = cityOverride ?? city;
    if (!effectiveCity.trim()) {
      setPendingQuery(q);
      setLocationSheetCity('');
      setShowLocationSheet(true);
      return;
    }
    setShowAutocomplete(false);
    setSearched(true);
    setSearchLoading(true);
    try {
      const response = await fetch(`${getBaseUrl()}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q || 'physiotherapie',
          city: effectiveCity,
          homeVisit: homeVisit || undefined,
          kassenart: kassenart || undefined,
        }),
      });
      if (!response.ok) throw new Error('failed');
      const payload = await response.json();
      const mapped = (payload.therapists ?? []).map(mapApiTherapist);
      const filtered = applyFilters(mapped);
      const withDist = withDistances(filtered, coords ?? userCoords);
      setResults(withDist);
      setAllApiTherapists(mapped);
    } catch {
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectChip = (chip) => {
    setActiveChip(chip);
    setQuery(chip.label);
    runSearchWith(chip.label, userCoords);
  };

  const selectSuggestion = (suggestion) => {
    setQuery(suggestion);
    runSearchWith(suggestion, userCoords);
  };

  const runSearch = () => runSearchWith(query, userCoords);

  const fetchLocationSuggestions = (text) => {
    setLocationSheetCity(text);
    pendingGPSResult.current = null; // user is typing manually — discard GPS result
    setLocationSuggestions([]);
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    if (text.length < 3) return;
    locationDebounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=6&countrycodes=de,at,ch&accept-language=de`;
        const res = await fetch(url, { headers: { 'User-Agent': 'RevioApp/1.0' } });
        const data = await res.json();
        setLocationSuggestions(data.map(item => ({
          label: item.display_name.split(',').slice(0, 3).join(',').trim(),
          city: item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || '',
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        })).filter(s => s.city));
      } catch {}
    }, 350);
  };

  const selectLocationSuggestion = (suggestion) => {
    setLocationSuggestions([]);
    setLocationSheetCity(suggestion.label);
    confirmLocationAndSearch(suggestion.city, { lat: suggestion.lat, lng: suggestion.lng }, suggestion.label);
  };

  const confirmLocationAndSearch = (resolvedCity, coords, label) => {
    setCity(resolvedCity);
    setLocationLabel(label || resolvedCity);
    if (coords) {
      setUserCoords(coords);
      AsyncStorage.setItem('savedCoords', JSON.stringify(coords));
    }
    AsyncStorage.setItem('savedCity', resolvedCity);
    AsyncStorage.setItem('savedLocationLabel', label || resolvedCity);
    setShowLocationSheet(false);
    if (pendingQuery !== null) runSearchWith(pendingQuery, coords, resolvedCity);
    setPendingQuery(null);
  };

  const handleLocationSheetGPS = async () => {
    setLocationLoading(true);

    if (Platform.OS === 'web') {
      if (!navigator?.geolocation) {
        Alert.alert('Fehler', 'Standortzugriff wird in diesem Browser nicht unterstützt.');
        setLocationLoading(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=de`
            );
            const data = await res.json();
            const addr = data?.address || {};
            const detectedCity = addr.city || addr.town || addr.village || addr.municipality || '';
            if (!detectedCity) {
              Alert.alert('Fehler', 'Stadt konnte nicht erkannt werden. Bitte manuell eingeben.');
              setLocationLoading(false);
              return;
            }
            const streetParts = [addr.road, addr.house_number].filter(Boolean).join(' ');
            const label = streetParts ? `${streetParts}, ${detectedCity}` : detectedCity;
            pendingGPSResult.current = { city: detectedCity, coords: { lat: latitude, lng: longitude }, label };
            setLocationSheetCity(label);
          } catch {
            Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
          }
          setLocationLoading(false);
        },
        () => {
          Alert.alert('Kein Zugriff', 'Bitte erlaube den Standortzugriff im Browser.');
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Kein Zugriff', 'Bitte erlaube den Standortzugriff in den Einstellungen.');
        setLocationLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      const detectedCity = geo?.city || '';
      if (!detectedCity) {
        Alert.alert('Fehler', 'Stadt konnte nicht erkannt werden. Bitte manuell eingeben.');
        setLocationLoading(false);
        return;
      }
      // Build display label: "Straße Hausnr., Stadt"
      const streetParts = [geo.street, geo.streetNumber].filter(Boolean).join(' ');
      const label = streetParts ? `${streetParts}, ${detectedCity}` : detectedCity;
      pendingGPSResult.current = { city: detectedCity, coords: { lat: loc.coords.latitude, lng: loc.coords.longitude }, label };
      setLocationSheetCity(label);
    } catch {
      Alert.alert('Fehler', 'Standort konnte nicht ermittelt werden.');
    }
    setLocationLoading(false);
  };

  const handleLocationSheetManual = async () => {
    const input = locationSheetCity.trim();
    if (!input) return;
    // If GPS already detected this exact location, use it directly — no re-geocoding needed
    if (pendingGPSResult.current && pendingGPSResult.current.label === input) {
      const { city: gpsCity, coords: gpsCoords, label: gpsLabel } = pendingGPSResult.current;
      pendingGPSResult.current = null;
      confirmLocationAndSearch(gpsCity, gpsCoords, gpsLabel);
      return;
    }
    setLocationLoading(true);
    try {
      if (Platform.OS === 'web') {
        // Use Nominatim for geocoding on web
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=1&accept-language=de`
        );
        const data = await res.json();
        if (data.length > 0) {
          const { lat, lon, display_name } = data[0];
          // Extract city from display_name or use input
          const revRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=de`
          );
          const revData = await revRes.json();
          const addr = revData?.address || {};
          const resolvedCity = addr.city || addr.town || addr.village || addr.municipality || input;
          const streetParts = [addr.road, addr.house_number].filter(Boolean).join(' ');
          const label = streetParts ? `${streetParts}, ${resolvedCity}` : resolvedCity;
          confirmLocationAndSearch(resolvedCity, { lat: parseFloat(lat), lng: parseFloat(lon) }, label);
        } else {
          confirmLocationAndSearch(input, null, input);
        }
      } else {
        // Try to geocode the input to get coordinates + normalized city
        const results = await Location.geocodeAsync(input);
        if (results.length > 0) {
          const { latitude, longitude } = results[0];
          const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
          const resolvedCity = geo?.city || input;
          const streetParts = [geo?.street, geo?.streetNumber].filter(Boolean).join(' ');
          const label = streetParts ? `${streetParts}, ${resolvedCity}` : resolvedCity;
          confirmLocationAndSearch(resolvedCity, { lat: latitude, lng: longitude }, label);
        } else {
          // Fallback: use input as-is (last word as city heuristic)
          confirmLocationAndSearch(input, null, input);
        }
      }
    } catch {
      confirmLocationAndSearch(input, null, input);
    }
    setLocationLoading(false);
  };

  // Load saved city + label + language from AsyncStorage on mount
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('savedCity'),
      AsyncStorage.getItem('savedLocationLabel'),
      AsyncStorage.getItem('appLanguage'),
      AsyncStorage.getItem('savedCoords'),
    ]).then(([savedCity, savedLabel, savedLang, savedCoords]) => {
      if (savedCity) setCity(savedCity);
      if (savedLabel) setLocationLabel(savedLabel);
      if (savedLang === 'de' || savedLang === 'en') setAppLanguage(savedLang);
      if (savedCoords) {
        try { setUserCoords(JSON.parse(savedCoords)); } catch {}
      }
    });
  }, []);



  // ── Open practice (always loads fresh therapist data) ─────────────────────

  const openPractice = async (practice) => {
    setSelectedPracticeTherapists([]);
    setSelectedPracticeLoading(true);
    setSelectedPracticeError('');
    setSelectedPractice(practice);
    try {
      const res = await fetch(`${getBaseUrl()}/practice-detail/${practice.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPracticeTherapists((data.therapists ?? []).map(th => ({
          ...th,
          photo: th.photo
            ? (th.photo.startsWith('http') ? th.photo : `${BASE_URL}${th.photo}`)
            : `https://i.pravatar.cc/96?u=${th.id}`,
          specializations: Array.isArray(th.specializations) ? th.specializations : [],
        })));
      } else {
        const body = await res.json().catch(() => ({}));
        console.error('[openPractice] status:', res.status, 'body:', JSON.stringify(body));
        setSelectedPracticeError(`Fehler ${res.status}: ${body.message ?? 'Therapeuten konnten nicht geladen werden.'}`);
      }
    } catch {
      setSelectedPracticeError('Verbindungsfehler beim Laden der Therapeuten.');
    } finally {
      setSelectedPracticeLoading(false);
    }
  };

  // ── Discover tab ──────────────────────────────────────────────────────────

  const renderDiscover = () => (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Logo-Zeile */}
      <View style={[styles.header, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
          <Text style={[styles.brandName, { color: c.text }]}>evio</Text>
        </View>
        {authToken && (
          <Pressable onPress={() => setShowNotifications(true)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'transparent', borderWidth: 2, borderColor: c.muted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={16} color={c.muted} />
            {notifications.length > 0 && (
              <View style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: '#E74C3C' }} />
            )}
          </Pressable>
        )}
      </View>

      {/* Hero — nur vor erster Suche */}
      {!searched && (
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: c.text }]}>{t('heroTitle')}</Text>
          <Text style={[styles.heroSub, { color: c.muted }]}>{t('heroSub')}</Text>
        </View>
      )}

      {/* Search input + filter icon — unified bar */}
      <View style={{ zIndex: 10 }}>
        <View style={[
          styles.searchBox,
          { backgroundColor: c.card, borderColor: (showAutocomplete && acSuggestions.length > 0) ? c.primary : c.border }
        ]}>
          {/* Left: search icon + input + clear */}
          <Ionicons name="search-outline" size={18} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setShowAutocomplete(true);
              setActiveChip(null);
            }}
            onSubmitEditing={() => runSearch()}
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => setTimeout(() => setShowAutocomplete(false), 150)}
            returnKeyType="search"
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={c.muted}
            style={[styles.searchInput, { color: c.text }]}
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setShowAutocomplete(false); }} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
            </Pressable>
          )}

          {/* Divider */}
          <View style={[styles.searchDivider, { backgroundColor: c.border }]} />

          {/* Right: filter area */}
          <Pressable onPress={() => setShowFilters(!showFilters)} style={styles.searchFilterArea} hitSlop={4}>
            <Ionicons
              name="options-outline"
              size={20}
              color={showFilters || activeFilterCount > 0 ? c.primary : c.muted}
            />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: c.accent }]}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Autocomplete dropdown */}
        {showAutocomplete && acSuggestions.length > 0 && (
          <View style={[styles.autocompleteBox, { backgroundColor: c.card, borderColor: c.primary }]}>
            {acSuggestions.map((s, i) => (
              <Pressable
                key={s}
                onPress={() => selectSuggestion(s)}
                style={[
                  styles.acItem,
                  i < acSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }
                ]}
              >
                <Text style={[styles.acSearchIcon, { color: c.muted }]}>⌕</Text>
                <Text style={[styles.acItemText, { color: c.text }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Quick chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {quickChips.map((chip) => {
          const active = activeChip?.label === chip.label;
          return (
            <Pressable
              key={chip.label}
              onPress={() => selectChip(chip)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: c.primary, borderColor: c.primary }
                  : { backgroundColor: c.card, borderColor: c.border }
              ]}
            >
              <Text style={[styles.chipText, { color: active ? '#FFFFFF' : c.text }]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Location pill — always visible, shows current location or prompt */}
      <Pressable
        onPress={() => { setLocationSheetCity(locationLabel || city); setShowLocationSheet(true); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          backgroundColor: city ? c.card : c.mutedBg, borderWidth: 1,
          borderColor: city ? c.accent : c.border, borderRadius: 20,
          paddingHorizontal: 12, paddingVertical: 6, maxWidth: 280 }}
      >
        <Ionicons name="navigate-sharp" size={13} color="#2b6877" />
        <Text numberOfLines={1} style={{ fontSize: 13, color: city ? c.text : c.muted, fontWeight: city ? '500' : '400', flexShrink: 1 }}>
          {locationLabel || city || t('locationPlaceholder')}
        </Text>
        <Text style={{ fontSize: 11, color: c.muted }}>▾</Text>
      </Pressable>

      {/* Expanded filter panel */}
      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: c.card, borderColor: c.border }]}>

          {/* Kassenart */}
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('kassenartLabel')}</Text>
          <View style={styles.kassenartRow}>
            {kassenartOptions.map(opt => {
              const active = kassenart === opt.key;
              return (
                <Pressable
                  key={String(opt.key)}
                  onPress={() => setKassenart(opt.key)}
                  style={[
                    styles.kassenartBtn,
                    active
                      ? { backgroundColor: c.primary, borderColor: c.primary }
                      : { backgroundColor: c.mutedBg, borderColor: c.border }
                  ]}
                >
                  <Text style={[styles.kassenartText, { color: active ? '#FFFFFF' : c.text }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Fortbildungen */}
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 14 }]}>{t('fortbildungLabel')}</Text>
          {fortbildungOptions.map(opt => {
            const checked = fortbildungen.includes(opt.key);
            return (
              <Pressable
                key={opt.key}
                onPress={() => toggleFortbildung(opt.key)}
                style={styles.checkRow}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primary : 'transparent' }
                ]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.checkLabel, { color: c.text }]}>{opt.label}</Text>
              </Pressable>
            );
          })}

          {/* Hausbesuche */}
          <View style={[styles.switchRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border }]}>
            <View>
              <Text style={[styles.switchTitle, { color: c.text }]}>{t('homeVisitLabel')}</Text>
              <Text style={[styles.switchLabel, { color: c.muted }]}>{t('homeVisitToggle')}</Text>
            </View>
            <Switch
              value={homeVisit}
              onValueChange={setHomeVisit}
              trackColor={{ true: c.success }}
            />
          </View>
        </View>
      )}

      {/* Section label */}
      {searched || results.length > 0 ? (
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionLabel, { color: c.text }]}>
            {searched ? `${results.length} ${results.length !== 1 ? t('resultsLabelPlural') : t('resultsLabel')}` : 'Vorschläge'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.approvedPill, { backgroundColor: c.successBg }]}>
              <Text style={[styles.approvedPillText, { color: c.success }]}>{t('verifiedOnly')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Result cards */}
      {results.map((th) => (
        <View key={th.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
          {/* Top row: avatar + name — tappable to open profile */}
          <View style={styles.cardTop}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => setSelectedTherapist(th)}>
              <Image source={{ uri: th.photo }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: c.text }]}>{th.fullName}</Text>
                <Text style={[styles.cardTitle, { color: c.muted }]}>{th.professionalTitle}</Text>
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
            <Pressable onPress={() => toggleFavorite(th)} hitSlop={10}>
              <Text style={{ fontSize: 22, color: isFavorite(th.id) ? '#E05A77' : c.muted }}>
                {isFavorite(th.id) ? '♥' : '♡'}
              </Text>
            </Pressable>
          </View>

          {/* Tags: Spezialisierungen + Sprachen + Hausbesuch */}
          <View style={styles.tagRow}>
            {th.specializations.map((s) => (
              <View key={s} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{s}</Text>
              </View>
            ))}
            {th.languages.map((l) => (
              <View key={l} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.muted }]}>{l}</Text>
              </View>
            ))}
            {th.homeVisit && (
              <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                <Text style={[styles.tagText, { color: c.success }]}>{t('homeVisitTag')}</Text>
              </View>
            )}
          </View>

          {/* Fortbildungen badges */}
          {th.fortbildungen?.length > 0 && (
            <View style={styles.tagRow}>
              {th.fortbildungen.map(f => (
                <View key={f} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                  <Text style={[styles.tagText, { color: c.success }]}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Praxis-Link */}
          {th.practices?.length > 0 && (
            <Pressable
              onPress={() => openPractice(th.practices[0])}
              style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}
            >
              <View style={[styles.practiceInitial, { backgroundColor: c.primary }]}>
                <Text style={[styles.practiceInitialText, { color: '#FFFFFF' }]}>
                  {th.practices[0].name.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().slice(0, 2) || th.practices[0].name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{th.practices[0].name}</Text>
                <Text style={[styles.practiceCity, { color: c.muted }]}>{th.practices[0].city}</Text>
              </View>
              {th.distKm != null && (
                <View style={[styles.distBadge, { backgroundColor: c.successBg }]}>
                  <Text style={[styles.distBadgeText, { color: c.success }]}>
                    {formatDist(th.distKm)}
                  </Text>
                </View>
              )}
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
          )}

          {/* CTA */}
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: c.accent }]}
            onPress={() => {
              callPhone(th.practices?.[0]?.phone);
            }}
          >
            <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
          </Pressable>
        </View>
      ))}

      {searchLoading && (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.emptyIcon]}>⏳</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('loading')}</Text>
        </View>
      )}

      {!searchLoading && results.length === 0 && searched && (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.emptyIcon]}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('noResults')}</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>{t('noResultsBody')}</Text>
        </View>
      )}
    </ScrollView>
  );

  // ── Practice profile ──────────────────────────────────────────────────────

  const sharePractice = async (practice) => {
    const url = `https://revio.app/p/${practice.id}`;
    const message = `${practice.name} – ${practice.city}\n${url}`;
    if (Platform.OS === 'web') {
      if (navigator.share) { navigator.share({ title: practice.name, url }); }
      else { navigator.clipboard.writeText(url); alert('Link kopiert!'); }
    } else {
      Share.share({ message });
    }
  };

  const renderPracticeProfile = (practice) => {
    const therapists = selectedPracticeTherapists;
    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => setSelectedPractice(null)} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => toggleFavoritePractice(practice)} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
              <Ionicons name={isPracticeFavorite(practice.id) ? 'heart' : 'heart-outline'} size={22} color={isPracticeFavorite(practice.id) ? '#E05A77' : c.muted} />
            </Pressable>
            <Pressable onPress={() => sharePractice(practice)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Ionicons name="share-outline" size={22} color={c.primary} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
          {practice.logo ? (
            <Image source={{ uri: practice.logo }} style={[styles.practiceLogoLarge, { borderRadius: 12 }]} />
          ) : (
            <View style={[styles.practiceLogoLarge, { backgroundColor: c.primary }]}>
              <View style={styles.practiceLogoCross}>
                <View style={[styles.plusBarH, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
                <View style={[styles.plusBarV, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
              </View>
              <Text style={styles.practiceLogoText}>
                {practice.name.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().slice(0, 2) || practice.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.practiceHeaderName, { color: c.text }]}>{practice.name}</Text>
          <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{practice.city}</Text>
        </View>

        {[
          practice.address && { icon: '📍', label: practice.address, onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.address)}`) },
          practice.phone && { icon: '📞', label: practice.phone, onPress: () => Linking.openURL(`tel:${practice.phone}`) },
          practice.hours && { icon: '🕐', label: practice.hours, onPress: null }
        ].filter(Boolean).map((row) => (
          <Pressable key={row.label} onPress={row.onPress ?? undefined} style={[styles.detailRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.detailIcon}>{row.icon}</Text>
            <Text style={[styles.detailText, { color: row.onPress ? c.primary : c.text }]}>{row.label}</Text>
          </Pressable>
        ))}

        {/* Praxisfotos */}
        {practice.photos?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {practice.photos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={{ width: 220, height: 145, borderRadius: 10 }} />
            ))}
          </ScrollView>
        )}

        {/* Praxisbeschreibung */}
        {!!practice.description && (
          <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 4, padding: 14, backgroundColor: c.card, borderRadius: 10, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Über die Praxis</Text>
            <Text style={{ color: c.text, fontSize: 14, lineHeight: 21 }}>{practice.description}</Text>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: c.text, marginTop: 4 }]}>
          {t('therapistsLabel')}{!selectedPracticeLoading && !selectedPracticeError ? ` (${therapists.length})` : ''}
        </Text>
        {selectedPracticeLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <ActivityIndicator color={c.primary} />
            <Text style={{ color: c.muted, marginTop: 8, fontSize: 13 }}>Lade Therapeuten…</Text>
          </View>
        ) : selectedPracticeError ? (
          <Text style={{ color: c.muted, fontSize: 13, paddingVertical: 8, marginHorizontal: 16 }}>{selectedPracticeError}</Text>
        ) : therapists.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 13, paddingVertical: 8, marginHorizontal: 16 }}>Keine Therapeuten gefunden</Text>
        ) : (
          therapists.map((th) => (
            <Pressable key={th.id} onPress={() => setSelectedTherapist(th)} style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Image source={{ uri: th.photo }} style={styles.miniAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: c.text }]}>{th.fullName}</Text>
                <Text style={[styles.cardTitle, { color: c.muted }]}>{th.professionalTitle}</Text>
                <View style={[styles.tagRow, { marginTop: 6 }]}>
                  {th.specializations.slice(0, 2).map((s) => (
                    <View key={s} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                      <Text style={[styles.tagText, { color: c.text }]}>{s}</Text>
                    </View>
                  ))}
                  {th.homeVisit && (
                    <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                      <Text style={[styles.tagText, { color: c.success }]}>{t('homeVisitTag')}</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
          ))
        )}

        <Pressable
          style={[styles.ctaBtn, { backgroundColor: c.accent, marginTop: 4 }]}
          onPress={() => callPhone(practice.phone)}
        >
          <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
        </Pressable>
      </ScrollView>
    );
  };

  // ── Therapist profile screen ──────────────────────────────────────────────

  const shareTherapist = async (t) => {
    const url = `https://revio.app/t/${t.id}`;
    const message = `${t.fullName} – ${t.professionalTitle}\n${url}`;
    if (Platform.OS === 'web') {
      if (navigator.share) { navigator.share({ title: t.fullName, url }); }
      else { navigator.clipboard.writeText(url); alert('Link kopiert!'); }
    } else {
      Share.share({ message });
    }
  };

  const renderTherapistProfile = (th) => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setSelectedTherapist(null)} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => toggleFavorite(th)} style={{ paddingHorizontal: 10, paddingVertical: 10 }}>
            <Ionicons name={isFavorite(th.id) ? 'heart' : 'heart-outline'} size={22} color={isFavorite(th.id) ? '#E05A77' : c.muted} />
          </Pressable>
          <Pressable onPress={() => shareTherapist(th)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
            <Ionicons name="share-outline" size={22} color={c.primary} />
          </Pressable>
        </View>
      </View>

      {/* Header */}
      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
        {th.photo ? (
          <Image source={{ uri: th.photo }} style={styles.therapistAvatarLarge} />
        ) : (
          <View style={[styles.therapistAvatarLarge, { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>
              {th.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.profileNameRow}>
          <Text style={[styles.practiceHeaderName, { color: c.text }]}>{th.fullName}</Text>
        </View>
        <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{th.professionalTitle}</Text>
        {((th.languages ?? []).length > 0 || th.homeVisit) && (
          <View style={[styles.tagRow, { justifyContent: 'center', marginTop: 8 }]}>
            {(th.languages ?? []).map(l => (
              <View key={l} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.muted }]}>{l}</Text>
              </View>
            ))}
            {th.homeVisit && (
              <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                <Text style={[styles.tagText, { color: c.success }]}>{t('homeVisitTag')}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Über mich */}
      {th.bio ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('aboutLabel')}</Text>
          <Text style={[styles.infoBody, { color: c.text, fontSize: 15 }]}>{th.bio}</Text>
        </View>
      ) : null}

      {/* Behandlungsbereiche */}
      {th.behandlungsbereiche?.length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('behandlungLabel')}</Text>
          <View style={styles.tagRow}>
            {th.behandlungsbereiche.map(b => (
              <View key={b} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Spezialisierungen */}
      {(th.specializations ?? []).length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('specsLabel')}</Text>
          <View style={styles.tagRow}>
            {th.specializations.map(s => (
              <View key={s} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{s}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Fortbildungen */}
      {th.fortbildungen?.length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('certsLabel')}</Text>
          <View style={styles.tagRow}>
            {th.fortbildungen.map(f => (
              <View key={f} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                <Text style={[styles.tagText, { color: c.success }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Details: Kassenart, Entfernung, Zeiten, Website */}
      {(th.kassenart || th.distKm != null || th.availability || th.website) && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('detailsLabel')}</Text>
          {th.kassenart ? (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>💳</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.muted }]}>{t('insuranceLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.kassenart.charAt(0).toUpperCase() + th.kassenart.slice(1)}</Text>
              </View>
            </View>
          ) : null}
          {th.distKm != null && (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>📍</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.muted }]}>{t('distanceLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{formatDist(th.distKm)} entfernt</Text>
              </View>
            </View>
          )}
          {th.availability ? (
            <View style={styles.detailInfoRow}>
              <Text style={styles.detailIcon}>🕐</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.muted }]}>{t('availabilityLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.availability}</Text>
              </View>
            </View>
          ) : null}
          {th.website ? (
            <Pressable style={styles.detailInfoRow} onPress={() => Linking.openURL(`https://${th.website}`)}>
              <Text style={styles.detailIcon}>🌐</Text>
              <View>
                <Text style={[styles.detailInfoLabel, { color: c.muted }]}>Website</Text>
                <Text style={[styles.detailInfoValue, { color: c.primary }]}>{th.website}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Praxis */}
      {th.practices?.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.text }]}>{t('practicesLabel')}</Text>
          {th.practices.map(p => (
            <Pressable
              key={p.id}
              onPress={() => { setSelectedTherapist(null); openPractice(p); }}
              style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}
            >
              <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                <Text style={[styles.practiceInitialText, { color: c.muted }]}>{p.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{p.name}</Text>
                <Text style={[styles.practiceCity, { color: c.muted }]}>{p.city}</Text>
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
          ))}
        </>
      )}

      <Pressable
        style={[styles.ctaBtn, { backgroundColor: c.accent, marginTop: 4 }]}
        onPress={() => {
          callPhone(th.practices?.[0]?.phone);
        }}
      >
        <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
      </Pressable>
    </ScrollView>
  );

  // ── Login screen ──────────────────────────────────────────────────────────

  const renderLogin = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <Pressable onPress={() => setShowLogin(false)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Anmelden</Text>
          <Text style={[styles.headerSub, { color: c.muted }]}>Therapeuten-Login</Text>
        </View>
      </View>

      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.filterSectionTitle, { color: c.muted }]}>E-Mail</Text>
        <TextInput
          style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
          value={loginEmail}
          onChangeText={setLoginEmail}
          placeholder="deine@email.de"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Passwort</Text>
        <TextInput
          style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
          value={loginPassword}
          onChangeText={setLoginPassword}
          placeholder="••••••••"
          placeholderTextColor={c.muted}
          secureTextEntry
        />
      </View>

      {loginError ? (
        <View style={[styles.noticeBox, { backgroundColor: '#FDECEA', borderColor: '#E74C3C', marginBottom: 8 }]}>
          <Text style={{ color: '#E74C3C', flex: 1 }}>{loginError}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.registerBtn, { backgroundColor: loginLoading ? c.border : c.primary }]}
        onPress={handleLogin}
        disabled={loginLoading}
      >
        <Text style={styles.registerBtnText}>{loginLoading ? 'Anmelden…' : 'Anmelden'}</Text>
      </Pressable>
    </ScrollView>
  );

  // ── Therapist dashboard (logged in) ───────────────────────────────────────

  const renderTherapistDashboard = () => {
    const th = loggedInTherapist;
    const initials = th.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    const enterEdit = () => {
      setEditBio(th.bio ?? '');
      setEditSpecializations((th.specializations ?? []).join(', '));
      setEditLanguages((th.languages ?? []).join(', '));
      setEditHomeVisit(th.homeVisit ?? false);
      setEditIsVisible(th.isVisible ?? true);
      setEditAvailability(th.availability ?? '');
      setEditMode(true);
    };

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
        {/* Header */}
        <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center' }]}>
          <Pressable onPress={handlePickPhoto} style={{ position: 'relative' }}>
            {th.photo ? (
              <Image source={{ uri: th.photo }} style={[styles.therapistAvatarLarge, { borderRadius: 48 }]} />
            ) : (
              <View style={[styles.therapistAvatarLarge, { borderRadius: 48, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{initials}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: c.accent, borderRadius: 12, padding: 4 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>📷</Text>
            </View>
          </Pressable>
          <Text style={[styles.practiceHeaderName, { color: c.text, marginTop: 10 }]}>{th.fullName}</Text>
          <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{th.professionalTitle}</Text>
          <View style={[styles.tag, { backgroundColor: th.reviewStatus === 'APPROVED' ? c.successBg : c.mutedBg, marginTop: 6 }]}>
            <Text style={{ color: th.reviewStatus === 'APPROVED' ? c.success : c.muted, fontSize: 12 }}>
              {th.reviewStatus === 'APPROVED' ? '✓ Freigegeben' : '⏳ In Prüfung'}
            </Text>
          </View>
        </View>

        {editMode ? (
          /* ── Edit form ── */
          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Über mich</Text>
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 80, textAlignVertical: 'top' }]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Kurze Beschreibung…"
              placeholderTextColor={c.muted}
              multiline
            />
            <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Spezialisierungen (kommagetrennt)</Text>
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
              value={editSpecializations}
              onChangeText={setEditSpecializations}
              placeholder="Rücken, Sport, Neurologie…"
              placeholderTextColor={c.muted}
            />
            <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Sprachen (kommagetrennt)</Text>
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
              value={editLanguages}
              onChangeText={setEditLanguages}
              placeholder="de, en…"
              placeholderTextColor={c.muted}
            />
            <View style={[styles.detailInfoRow, { marginTop: 12 }]}>
              <Text style={[styles.detailInfoLabel, { color: c.text, flex: 1 }]}>Hausbesuch</Text>
              <Switch value={editHomeVisit} onValueChange={setEditHomeVisit} trackColor={{ true: c.primary }} />
            </View>
            <View style={[styles.detailInfoRow, { marginTop: 12 }]}>
              <Text style={[styles.detailInfoLabel, { color: c.text, flex: 1 }]}>In Suche sichtbar</Text>
              <Switch
                value={editIsVisible}
                onValueChange={async (val) => {
                  setEditIsVisible(val);
                  if (authToken) {
                    const pref = val ? 'visible' : 'hidden';
                    try {
                      const res = await fetch(`${getBaseUrl()}/invite/visibility`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                        body: JSON.stringify({ visibilityPreference: pref }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && val && !data.isPublished && data.missingFields?.length > 0) {
                        const fields = data.missingFields.join(', ');
                        Alert.alert('Profil unvollständig', `Fülle noch folgende Felder aus, damit dein Profil sichtbar wird: ${fields}`);
                      }
                    } catch {}
                  }
                }}
                trackColor={{ true: c.primary }}
              />
            </View>
            <Text style={[styles.detailInfoLabel, { color: c.muted, marginTop: 14, marginBottom: 4 }]}>Sprechzeiten</Text>
            <TextInput
              style={[styles.registerInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
              value={editAvailability}
              onChangeText={setEditAvailability}
              placeholder="z.B. Mo–Fr 8:00–18:00 Uhr"
              placeholderTextColor={c.muted}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable style={[styles.registerBtn, { flex: 1, backgroundColor: c.border, marginTop: 0 }]} onPress={() => setEditMode(false)}>
                <Text style={[styles.registerBtnText, { color: c.text }]}>Abbrechen</Text>
              </Pressable>
              <Pressable style={[styles.registerBtn, { flex: 1, backgroundColor: profileSaving ? c.border : c.primary, marginTop: 0 }]} onPress={handleSaveProfile} disabled={profileSaving}>
                <Text style={styles.registerBtnText}>{profileSaving ? 'Speichern…' : 'Speichern'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── View mode ── */
          <>
            {th.bio ? (
              <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('aboutLabel')}</Text>
                <Text style={[styles.infoBody, { color: c.text }]}>{th.bio}</Text>
              </View>
            ) : null}

            <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('specsLabel')}</Text>
              <View style={styles.tagRow}>
                {(th.specializations ?? []).map(s => (
                  <View key={s} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                    <Text style={[styles.tagText, { color: c.text }]}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Sprachen</Text>
              <View style={styles.tagRow}>
                {(th.languages ?? []).map(l => (
                  <View key={l} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                    <Text style={[styles.tagText, { color: c.muted }]}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.detailInfoRow}>
                <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>{t('homeVisitLabel')}</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.homeVisit ? 'Ja' : 'Nein'}</Text>
              </View>
              {th.availability ? (
                <View style={[styles.detailInfoRow, { marginTop: 8 }]}>
                  <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>{t('availabilityLabel')}</Text>
                  <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.availability}</Text>
                </View>
              ) : null}
              <View style={[styles.detailInfoRow, { marginTop: 8 }]}>
                <Text style={[styles.detailInfoLabel, { color: c.muted, flex: 1 }]}>E-Mail</Text>
                <Text style={[styles.detailInfoValue, { color: c.text }]}>{th.email}</Text>
              </View>
            </View>

            <Pressable style={[styles.registerBtn, { backgroundColor: c.primary }]} onPress={enterEdit}>
              <Text style={styles.registerBtnText}>✏️ Profil bearbeiten</Text>
            </Pressable>

            {/* Verbundene Praxen */}
            {(th.practices ?? []).length > 0 && (
              <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{t('practicesLabel')}</Text>
                {(th.practices ?? []).map(p => (
                  <Pressable key={p.id} onPress={() => openPractice(p)} style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}>
                    <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                      <Text style={[styles.practiceInitialText, { color: c.muted }]}>{p.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.practiceName, { color: c.text }]}>{p.name}</Text>
                      <Text style={[styles.practiceCity, { color: c.muted }]}>{p.city}</Text>
                      {p.phone ? <Text style={[styles.practiceCity, { color: c.muted }]}>{p.phone}</Text> : null}
                    </View>
                    {th.adminPractice?.id === p.id && (
                      <>
                        <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                          <Text style={{ color: c.success, fontSize: 11 }}>Admin</Text>
                        </View>
                        <Pressable
                          onPress={() => { setInvitePageTab('new'); if (!inviteToken) handleLoadInviteToken(); setShowInvitePage(true); }}
                          style={{ padding: 6 }}
                          hitSlop={8}
                        >
                          <Ionicons name="person-add-outline" size={18} color={c.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => { setAdminPracticeDetail(null); loadAdminPracticeDetail(); setShowPracticeAdmin(true); }}
                          style={{ padding: 6 }}
                          hitSlop={8}
                        >
                          <Ionicons name="settings-outline" size={18} color={c.primary} />
                        </Pressable>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Praxis-Verbindung */}
            {(th.practices ?? []).length === 0 && (
              <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                <Text style={styles.noticeIcon}>🏥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noticeTitle, { color: c.text }]}>Keine Praxis verknüpft</Text>
                  <Text style={[styles.noticeBody, { color: c.muted }]}>Verbinde dich mit einer Praxis oder erstelle deine eigene.</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Pressable
                      onPress={() => { setPracticeSearchQuery(''); setPracticeSearchResults([]); setShowPracticeSearch(true); }}
                      style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, flex: 1 }]}
                    >
                      <Text style={[styles.kassenartText, { color: '#fff' }]}>Praxis suchen</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setShowCreatePractice(true)}
                      style={[styles.kassenartBtn, { backgroundColor: c.mutedBg, borderColor: c.border, flex: 1 }]}
                    >
                      <Text style={[styles.kassenartText, { color: c.text }]}>Neue Praxis</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

      </ScrollView>
    );
  };

  // ── Therapist tab ─────────────────────────────────────────────────────────

  const renderTherapist = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Für Therapeuten</Text>
          <Text style={[styles.headerSub, { color: c.muted }]}>Dein Profil auf Revio</Text>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }]}>
        <Text style={{ fontSize: 28 }}>⚕️</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoTitle, { color: c.text, marginBottom: 2 }]}>Werde auf Revio sichtbar</Text>
          <Text style={[styles.noticeBody, { color: c.muted }]}>
            Nur für zugelassene Physiotherapeuten. Dein Profil wird vor der Veröffentlichung manuell geprüft.
          </Text>
        </View>
      </View>

      {[
        { num: '1', title: 'Registrieren', body: 'Konto mit E-Mail anlegen' },
        { num: '2', title: 'Profil ausfüllen', body: 'Spezialisierungen, Ausbildung, Sprachen, Praxis' },
        { num: '3', title: 'Zur Prüfung einreichen', body: __DEV__ ? 'Entwicklungsmodus: sofort freigegeben' : 'Manuell geprüft — in der Regel innerhalb von 48 h' },
        { num: '4', title: 'Öffentlich sichtbar', body: 'Dein Profil erscheint in den Suchergebnissen' }
      ].map((step) => (
        <View key={step.num} style={[styles.stepRow, { borderColor: c.border }]}>
          <View style={[styles.stepNum, { backgroundColor: c.primary }]}>
            <Text style={styles.stepNumText}>{step.num}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.stepTitle, { color: c.text }]}>{step.title}</Text>
            <Text style={[styles.stepBody, { color: c.muted }]}>{step.body}</Text>
          </View>
        </View>
      ))}

      <Pressable style={[styles.registerBtn, { backgroundColor: c.primary }]} onPress={() => { setRegStep(1); setRegSubmitted(false); setShowRegister(true); }}>
        <Text style={styles.registerBtnText}>Jetzt registrieren</Text>
      </Pressable>

      <Pressable onPress={() => setShowLogin(true)}>
        <Text style={[styles.loginLink, { color: c.primary }]}>Bereits registriert? Anmelden</Text>
      </Pressable>
    </ScrollView>
  );

  // ── Optionen tab ──────────────────────────────────────────────────────────

  const renderOptions = () => (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>{t('optionsTitle')}</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>{t('optionsSubtitle')}</Text>
          </View>
        </View>

        {[
          { label: t('privacyOption'), value: t('comingSoon') },
          { label: t('imprintOption'), value: t('comingSoon') },
          { label: t('appVersionOption'), value: '0.1.0 MVP' }
        ].map((item) => (
          <Pressable key={item.label} style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.optionLabel, { color: c.text }]}>{item.label}</Text>
            <Text style={[styles.optionValue, { color: c.muted }]}>{item.value} ›</Text>
          </Pressable>
        ))}

        {/* Sprache toggle */}
        <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.optionLabel, { color: c.text }]}>{t('languageOption')}</Text>
          <View style={styles.themeToggleRow}>
            {[
              { key: 'de', label: 'DE' },
              { key: 'en', label: 'EN' },
            ].map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => {
                  setAppLanguage(key);
                  AsyncStorage.setItem('appLanguage', key);
                }}
                style={[
                  styles.themeBtn,
                  appLanguage === key
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.mutedBg, borderColor: c.border }
                ]}
              >
                <Text style={[styles.themeBtnText, { color: appLanguage === key ? '#FFFFFF' : c.muted }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Erscheinungsbild toggle */}
        <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.optionLabel, { color: c.text }]}>{t('appearanceOption')}</Text>
          <View style={styles.themeToggleRow}>
            {[
              { key: 'light',  label: t('themeLight') },
              { key: 'dark',   label: t('themeDark') },
              { key: 'system', label: t('themeSystem') }
            ].map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => setThemeMode(key)}
                style={[
                  styles.themeBtn,
                  themeMode === key
                    ? { backgroundColor: c.primary, borderColor: c.primary }
                    : { backgroundColor: c.mutedBg, borderColor: c.border }
                ]}
              >
                <Text style={[styles.themeBtnText, { color: themeMode === key ? '#FFFFFF' : c.muted }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loggedInTherapist && (
          <>
            <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>{t('myPractice')}</Text>
            {loggedInTherapist.adminPractice ? (
              <Pressable
                onPress={() => { setAdminPracticeDetail(null); loadAdminPracticeDetail(); setShowPracticeAdmin(true); }}
                style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <View>
                  <Text style={[styles.optionLabel, { color: c.text }]}>{loggedInTherapist.adminPractice.name}</Text>
                  <Text style={[{ fontSize: 12, color: c.muted }]}>{loggedInTherapist.adminPractice.city}</Text>
                </View>
                <Text style={[styles.optionValue, { color: c.primary }]}>{t('managePractice')} ›</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={() => setShowCreatePractice(true)}
                  style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
                >
                  <Text style={[styles.optionLabel, { color: c.text }]}>{t('newPractice')}</Text>
                  <Text style={[styles.optionValue, { color: c.primary }]}>＋</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setPracticeSearchQuery(''); setPracticeSearchResults([]); setShowPracticeSearch(true); }}
                  style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
                >
                  <Text style={[styles.optionLabel, { color: c.text }]}>{t('linkPractice')}</Text>
                  <Text style={[styles.optionValue, { color: c.primary }]}>🔗</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {!loggedInTherapist && (
          <Pressable
            onPress={() => { setActiveTab('therapist'); setShowLogin(true); }}
            style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Text style={[styles.optionLabel, { color: c.muted }]}>{t('notLoggedIn')}</Text>
            <Text style={[styles.optionValue, { color: c.primary }]}>{t('loginAction')} ›</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Abmelden + Konto löschen — fixed am unteren Rand */}
      {loggedInTherapist && (
        <View style={{ marginHorizontal: 16, marginBottom: 16, gap: 10 }}>
          <Pressable
            onPress={handleLogout}
            style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#E74C3C' }}
          >
            <Text style={{ color: '#E74C3C', fontSize: 16, fontWeight: '600' }}>{t('logoutBtn')}</Text>
          </Pressable>
          <Pressable
            onPress={handleDeleteAccount}
            style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: c.muted, fontSize: 14 }}>{t('deleteAccount')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  // ── Neue Praxis erstellen ─────────────────────────────────────────────────

  const renderCreatePractice = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => setShowCreatePractice(false)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Neue Praxis</Text>
          <Text style={[styles.headerSub, { color: c.muted }]}>Erstelle und verwalte deine Praxis</Text>
        </View>
      </View>

      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Praxisname *</Text>
        <TextInput
          style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
          value={createPracticeName} onChangeText={setCreatePracticeName}
          placeholder="z. B. Physio am Markt" placeholderTextColor={c.muted}
        />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Stadt *</Text>
        <TextInput
          style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
          value={createPracticeCity} onChangeText={setCreatePracticeCity}
          placeholder="z. B. Köln" placeholderTextColor={c.muted}
        />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Adresse</Text>
        <TextInput
          style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
          value={createPracticeAddress} onChangeText={setCreatePracticeAddress}
          placeholder="Straße und Hausnummer" placeholderTextColor={c.muted}
        />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Telefon</Text>
        <TextInput
          style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
          value={createPracticePhone} onChangeText={setCreatePracticePhone}
          placeholder="+49 221 …" placeholderTextColor={c.muted} keyboardType="phone-pad"
        />
        <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 12 }]}>Öffnungszeiten</Text>
        <TextInput
          style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
          value={createPracticeHours} onChangeText={setCreatePracticeHours}
          placeholder="Mo–Fr 8:00–18:00" placeholderTextColor={c.muted}
        />
      </View>

      <Pressable
        style={[styles.registerBtn, { backgroundColor: createPracticeLoading ? c.border : c.primary }]}
        onPress={handleCreatePractice}
        disabled={createPracticeLoading}
      >
        <Text style={styles.registerBtnText}>{createPracticeLoading ? 'Wird erstellt…' : 'Praxis erstellen'}</Text>
      </Pressable>
    </ScrollView>
  );

  // ── Praxis suchen & vernetzen ─────────────────────────────────────────────

  const renderPracticeSearch = () => (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setShowPracticeSearch(false)} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
        </Pressable>
        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Praxis vernetzen</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>Finde deine Praxis und sende eine Anfrage</Text>
          </View>
        </View>

        <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.border }]}>
          <TextInput
            style={[{ flex: 1, color: c.text, fontSize: 16 }]}
            value={practiceSearchQuery}
            onChangeText={setPracticeSearchQuery}
            onSubmitEditing={handleSearchPractices}
            placeholder="Praxisname oder Stadt…"
            placeholderTextColor={c.muted}
            returnKeyType="search"
          />
          <Pressable onPress={handleSearchPractices}>
            <Text style={{ fontSize: 20, color: c.primary }}>⌕</Text>
          </Pressable>
        </View>

        {practiceSearchLoading && (
          <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>Suche…</Text>
        )}

        {practiceSearchResults.map(p => (
          <View key={p.id} style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 8 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                <Text style={[styles.practiceInitialText, { color: c.muted }]}>{p.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{p.name}</Text>
                <Text style={[styles.practiceCity, { color: c.muted }]}>{p.city}{p.address ? ` · ${p.address}` : ''}</Text>
                <Text style={[{ fontSize: 12, color: c.muted }]}>{p.links?.length ?? 0} Therapeuten</Text>
              </View>
            </View>
            <Pressable
              onPress={() => handleConnectToPractice(p.id)}
              style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, alignSelf: 'flex-start' }]}
            >
              <Text style={[styles.kassenartText, { color: '#fff' }]}>Anfrage senden</Text>
            </Pressable>
          </View>
        ))}

        {!practiceSearchLoading && practiceSearchResults.length === 0 && practiceSearchQuery.length > 0 && (
          <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Keine Praxis gefunden</Text>
            <Text style={[styles.emptyBody, { color: c.muted }]}>Erstelle eine neue Praxis in den Optionen.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  // ── Praxis-Admin Dashboard ────────────────────────────────────────────────

  const renderInvitePage = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => setShowInvitePage(false)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
      </Pressable>
      <Text style={[styles.profileName, { color: c.text, marginBottom: 16 }]}>Therapeuten einladen</Text>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', backgroundColor: c.mutedBg, borderRadius: 12, padding: 3, marginBottom: 20 }}>
        {[{ key: 'new', label: 'Neuer Therapeut' }, { key: 'link', label: 'Einladungslink' }].map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setInvitePageTab(tab.key)}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
              backgroundColor: invitePageTab === tab.key ? c.card : 'transparent' }}
          >
            <Text style={{ fontSize: 14, fontWeight: invitePageTab === tab.key ? '700' : '500',
              color: invitePageTab === tab.key ? c.text : c.muted }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {invitePageTab === 'new' ? (
        /* ── Neuer Therapeut tab ── */
        <View style={{ gap: 12 }}>
          <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>PROFIL ERSTELLEN & EINLADEN</Text>
            {[
              { label: 'Name *', value: createTherapistName, setter: setCreateTherapistName, placeholder: 'Max Mustermann' },
              { label: 'E-Mail *', value: createTherapistEmail, setter: setCreateTherapistEmail, placeholder: 'therapeut@email.de', keyboard: 'email-address', lower: true },
              { label: 'Berufsbezeichnung *', value: createTherapistTitle, setter: setCreateTherapistTitle, placeholder: 'Physiotherapeut/in' },
            ].map(({ label, value, setter, placeholder, keyboard, lower }) => (
              <View key={label}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{label}</Text>
                <TextInput
                  style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
                  value={value}
                  onChangeText={setter}
                  placeholder={placeholder}
                  placeholderTextColor={c.muted}
                  keyboardType={keyboard ?? 'default'}
                  autoCapitalize={lower ? 'none' : 'words'}
                />
              </View>
            ))}
            {!!createTherapistError && (
              <Text style={{ color: '#E74C3C', fontSize: 13 }}>{createTherapistError}</Text>
            )}
            <Pressable
              onPress={handleCreateTherapist}
              disabled={createTherapistLoading}
              style={{ backgroundColor: createTherapistLoading ? c.border : c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                {createTherapistLoading ? 'Wird erstellt…' : 'Profil erstellen & einladen'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* ── Einladungslink tab ── */
        <View style={{ gap: 16 }}>
          {inviteTokenLoading ? (
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>Link wird erstellt…</Text>
          ) : inviteToken ? (
            <>
              <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 8 }]}>
                <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Einladungslink</Text>
                <Text selectable style={{ color: c.text, fontSize: 13, fontFamily: 'monospace', backgroundColor: c.mutedBg, padding: 10, borderRadius: 8 }}>
                  {`https://revio.app/join/${inviteToken.token}`}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  Teile diesen Link mit Therapeuten. Sie können damit eine Beitrittsanfrage an deine Praxis senden.
                </Text>
              </View>
              <Pressable
                onPress={handleShareInviteLink}
                style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Link teilen</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={handleLoadInviteToken}
              style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Link erstellen</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderPracticeAdmin = () => {
    const p = adminPracticeDetail;
    if (!p) return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[styles.infoBody, { color: c.muted }]}>Wird geladen…</Text>
      </View>
    );
    const confirmed = p.links?.filter(l => l.status === 'CONFIRMED') ?? [];
    const pending = p.links?.filter(l => l.status === 'PROPOSED') ?? [];

    // Pre-fill edit fields from loaded practice (only when empty/first open)
    if (editPracticeName === '' && p.name) {
      setEditPracticeName(p.name);
      setEditPracticeCity(p.city ?? '');
      setEditPracticeAddress(p.address ?? '');
      setEditPracticePhone(p.phone ?? '');
      setEditPracticeHours(p.hours ?? '');
      setEditPracticeDescription(p.description ?? '');
      if (p.logo) setEditPracticeLogo(p.logo);
      if (p.photos) {
        try { setEditPracticePhotos(JSON.parse(p.photos)); } catch {}
      }
    }

    return (
      <ScrollView
        ref={practiceAdminScrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
        onLayout={() => {
          if (scrollToInvite && inviteSectionY.current > 0) {
            setTimeout(() => {
              practiceAdminScrollRef.current?.scrollTo({ y: inviteSectionY.current, animated: true });
              setScrollToInvite(false);
            }, 300);
          }
        }}
      >
        <Pressable onPress={() => { setShowPracticeAdmin(false); setEditPracticeName(''); setEditPracticeLogo(null); setEditPracticePhotos([]); }} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {t('backBtn')}</Text>
        </Pressable>

        {/* Praxis-Header */}
        <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
          {p.logo ? (
            <Image source={{ uri: p.logo }} style={[styles.practiceHeaderInitial, { borderRadius: 12 }]} />
          ) : (
            <View style={[styles.practiceHeaderInitial, { backgroundColor: c.primary }]}>
              <Text style={styles.practiceHeaderInitialText}>{p.name.charAt(0)}</Text>
              <Text style={{ color: '#fff', fontSize: 12 }}>✚</Text>
            </View>
          )}
          <Text style={[styles.practiceHeaderName, { color: c.text, marginTop: 10 }]}>{p.name}</Text>
          <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{p.city}</Text>
          {p.address ? <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{p.address}</Text> : null}
          {p.phone ? <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{p.phone}</Text> : null}
        </View>

        {/* Ausstehende Anfragen */}
        {pending.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: c.text }]}>Anfragen ({pending.length})</Text>
            {pending.map(link => (
              <View key={link.id} style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  onPress={() => openTherapistById(link.therapist.id)}>
                  <Image
                    source={{ uri: link.therapist.photo || `https://i.pravatar.cc/96?u=${link.therapist.id}` }}
                    style={[styles.therapistAvatarSmall, { borderRadius: 20 }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.therapistName, { color: c.text }]}>{link.therapist.fullName}</Text>
                    <Text style={[styles.therapistTitle, { color: c.muted }]}>{link.therapist.professionalTitle}</Text>
                  </View>
                  <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => handleLinkAction(link.id, 'accept')}
                    style={[styles.kassenartBtn, { backgroundColor: c.success, borderColor: c.success, flex: 1 }]}
                  >
                    <Text style={[styles.kassenartText, { color: '#fff' }]}>✓ Annehmen</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleLinkAction(link.id, 'reject')}
                    style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: '#E74C3C', flex: 1 }]}
                  >
                    <Text style={[styles.kassenartText, { color: '#E74C3C' }]}>✕ Ablehnen</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Bestätigte Therapeuten */}
        <Text style={[styles.sectionLabel, { color: c.text }]}>Therapeuten ({confirmed.length})</Text>
        {confirmed.map(link => {
          const th = link.therapist;
          const isInvited = th.invitedByPracticeId === p.id;
          const statusLabel = isInvited
            ? th.onboardingStatus === 'invited' ? 'Einladung ausstehend'
              : th.onboardingStatus === 'claimed' ? 'Profil wird ausgefüllt'
              : th.isPublished ? 'Veröffentlicht' : 'Profil vollständig'
            : null;
          const statusColor = th.onboardingStatus === 'invited' ? '#F59E0B'
            : th.onboardingStatus === 'claimed' ? '#3B82F6'
            : '#10B981';
          return (
            <View key={link.id} style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 0 }]}>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                onPress={() => openTherapistById(th.id)}>
                <Image
                  source={{ uri: th.photo || `https://i.pravatar.cc/96?u=${th.id}` }}
                  style={[styles.therapistAvatarSmall, { borderRadius: 20 }]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.therapistName, { color: c.text }]}>{th.fullName}</Text>
                  <Text style={[styles.therapistTitle, { color: c.muted }]}>{th.professionalTitle}</Text>
                  <Text style={{ fontSize: 12, color: c.muted }}>{th.email}</Text>
                  {statusLabel && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
                      <Text style={{ fontSize: 11, color: statusColor, fontWeight: '600' }}>{statusLabel}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
              </Pressable>
              {isInvited && th.onboardingStatus === 'invited' && (
                <Pressable
                  onPress={() => handleResendInvite(th.id)}
                  style={{ marginTop: 10, paddingVertical: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: c.border }}
                >
                  <Text style={{ fontSize: 13, color: c.primary, fontWeight: '600' }}>Einladung erneut senden</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        {confirmed.length === 0 && pending.length === 0 && (
          <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>Noch keine Therapeuten</Text>
            <Text style={[styles.emptyBody, { color: c.muted }]}>Lade Therapeuten per E-Mail ein.</Text>
          </View>
        )}

        {/* Praxisdaten bearbeiten */}
        <Text style={[styles.sectionLabel, { color: c.text }]}>Praxisdaten bearbeiten</Text>
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
          {[
            { label: 'Name *', value: editPracticeName, setter: setEditPracticeName, placeholder: 'Praxisname' },
            { label: 'Stadt *', value: editPracticeCity, setter: setEditPracticeCity, placeholder: 'Stadt' },
            { label: 'Adresse', value: editPracticeAddress, setter: setEditPracticeAddress, placeholder: 'Straße Nr, PLZ Stadt' },
            { label: 'Telefon', value: editPracticePhone, setter: setEditPracticePhone, placeholder: '+49 …', keyboard: 'phone-pad' },
            { label: 'Öffnungszeiten', value: editPracticeHours, setter: setEditPracticeHours, placeholder: 'Mo–Fr 8:00–18:00' },
          ].map(({ label, value, setter, placeholder, keyboard }) => (
            <View key={label}>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>{label}</Text>
              <TextInput
                style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg }]}
                value={value}
                onChangeText={setter}
                placeholder={placeholder}
                placeholderTextColor={c.muted}
                keyboardType={keyboard ?? 'default'}
              />
            </View>
          ))}

          {/* Beschreibung (multiline) */}
          <View>
            <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Beschreibung</Text>
            <TextInput
              style={[styles.inputField, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, minHeight: 90, textAlignVertical: 'top' }]}
              value={editPracticeDescription}
              onChangeText={setEditPracticeDescription}
              placeholder="Stellen Sie Ihre Praxis vor …"
              placeholderTextColor={c.muted}
              multiline
            />
          </View>
          {/* Logo */}
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Logo</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {editPracticeLogo ? (
              <Image source={{ uri: editPracticeLogo }} style={{ width: 64, height: 64, borderRadius: 8 }} />
            ) : (
              <View style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{editPracticeName.charAt(0) || '?'}</Text>
                <Text style={{ color: '#fff', fontSize: 10 }}>✚</Text>
              </View>
            )}
            <Pressable onPress={handlePickPracticeLogo} style={[styles.kassenartBtn, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
              <Text style={[styles.kassenartText, { color: c.text }]}>📷 Logo ändern</Text>
            </Pressable>
            {editPracticeLogo && (
              <Pressable onPress={() => setEditPracticeLogo(null)} style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: '#E74C3C' }]}>
                <Text style={[styles.kassenartText, { color: '#E74C3C' }]}>Entfernen</Text>
              </Pressable>
            )}
          </View>

          {/* Praxisfotos */}
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 4 }]}>Praxisfotos</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {editPracticePhotos.map((photo, idx) => (
              <View key={idx} style={{ position: 'relative' }}>
                <Image source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: 6 }} />
                <Pressable
                  onPress={() => setEditPracticePhotos(prev => prev.filter((_, i) => i !== idx))}
                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#E74C3C', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={handleAddPracticePhoto}
              style={{ width: 80, height: 80, borderRadius: 6, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.mutedBg }}
            >
              <Text style={{ color: c.muted, fontSize: 28 }}>＋</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleSavePractice}
            style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, marginTop: 4 }]}
          >
            <Text style={[styles.kassenartText, { color: '#fff' }]}>
              {practiceEditSaving ? 'Wird gespeichert…' : 'Speichern'}
            </Text>
          </Pressable>
        </View>

        {/* Therapeuten einladen */}
        <Pressable
          onLayout={e => { inviteSectionY.current = e.nativeEvent.layout.y; }}
          onPress={() => { setInvitePageTab('new'); if (!inviteToken) handleLoadInviteToken(); setShowInvitePage(true); }}
          style={[styles.kassenartBtn, { backgroundColor: 'transparent', borderColor: c.border, alignSelf: 'flex-start', marginBottom: 8 }]}
        >
          <Text style={[styles.kassenartText, { color: c.muted }]}>+ Therapeut einladen</Text>
        </Pressable>

        {/* Praxis löschen */}
        <Pressable
          onPress={handleDeletePractice}
          style={{ marginTop: 8, marginBottom: 8, alignItems: 'center', paddingVertical: 14 }}
        >
          <Text style={{ color: c.muted, fontSize: 14 }}>Praxis löschen</Text>
        </Pressable>
      </ScrollView>
    );
  };

  // ── Favorites tab ─────────────────────────────────────────────────────────

  const renderFavorites = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}><Text style={styles.logoText}>R</Text></View>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('favoritesTitle')}</Text>
      </View>

      <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border, marginBottom: 4 }]}>
        <View style={styles.lockBadge}>
          <Ionicons name="accessibility" size={16} color="#6b8fa0" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.noticeBody, { color: c.muted, flex: 0 }]}>{t('favoritesHint')}</Text>
        </View>
      </View>

      {favorites.length === 0 && favoritePractices.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{t('favoritesEmpty')}</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>{t('favoritesEmptyBody')}</Text>
        </View>
      ) : null}

      {favorites.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.text }]}>{t('favoritesTherapists')}</Text>
          {favorites.map((fav) => (
            <View key={fav.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.cardTop}>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => setSelectedTherapist(fav)}>
                  <Image source={{ uri: fav.photo }} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: c.text }]}>{fav.fullName}</Text>
                    <Text style={[styles.cardTitle, { color: c.muted }]}>{fav.professionalTitle}</Text>
                  </View>
                  <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
                </Pressable>
                <Pressable onPress={() => toggleFavorite(fav)} hitSlop={10}>
                  <Ionicons name="heart" size={22} color="#E05A77" />
                </Pressable>
              </View>
              {fav.practices?.length > 0 && (
                <Pressable
                  onPress={() => openPractice(fav.practices[0])}
                  style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}
                >
                  <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                    <Text style={[styles.practiceInitialText, { color: c.muted }]}>{fav.practices[0].name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.practiceName, { color: c.text }]}>{fav.practices[0].name}</Text>
                    <Text style={[styles.practiceCity, { color: c.muted }]}>{fav.practices[0].city}</Text>
                  </View>
                  <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.ctaBtn, { backgroundColor: c.accent }]}
                onPress={() => callPhone(fav.practices?.[0]?.phone)}
              >
                <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      {favoritePractices.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.text, marginTop: favorites.length > 0 ? 8 : 0 }]}>{t('favoritesPractices')}</Text>
          {favoritePractices.map((p) => {
            return (
            <View key={p.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Pressable onPress={() => openPractice(p)} style={styles.cardTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  {p.logo ? (
                    <Image source={{ uri: p.logo }} style={[styles.avatar, { borderRadius: 10 }]} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: c.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                        {p.name.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().slice(0, 2) || p.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: c.text }]}>{p.name}</Text>
                    <Text style={[styles.cardTitle, { color: c.muted }]}>{p.city}</Text>
                  </View>
                  <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
                </View>
                <Pressable onPress={(e) => { e.stopPropagation(); toggleFavoritePractice(p); }} hitSlop={10}>
                  <Ionicons name="heart" size={22} color="#E05A77" />
                </Pressable>
              </Pressable>
              {p.phone && (
                <Pressable
                  style={[styles.ctaBtn, { backgroundColor: c.accent }]}
                  onPress={() => callPhone(p.phone)}
                >
                  <Text style={styles.ctaBtnText}>{t('callPractice')}</Text>
                </Pressable>
              )}
            </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );

  // ── Register flow ──────────────────────────────────────────────────────────

  const renderRegister = () => {
    if (regSubmitted) {
      return (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
          <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, alignItems: 'center', paddingVertical: 40 }]}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>Eingereicht!</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center', marginTop: 8 }]}>
              {__DEV__
                ? 'Entwicklungsmodus: Dein Profil wurde automatisch freigegeben und ist sofort in der Suche sichtbar.'
                : 'Dein Profil wird innerhalb von 48 Stunden manuell geprüft. Den Status kannst du jederzeit in der App unter „Für Therapeuten" einsehen.'}
            </Text>
            <Pressable
              style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 24, paddingHorizontal: 32 }]}
              onPress={() => { setShowRegister(false); setRegSubmitted(false); setRegStep(1); }}
            >
              <Text style={styles.registerBtnText}>Zurück zur App</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    const renderProgress = () => (
      <View style={styles.regProgressRow}>
        {Array.from({ length: REG_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.regProgressBar, { backgroundColor: i < regStep ? c.primary : c.border }]}
          />
        ))}
      </View>
    );

    const canProceed = () => {
      switch (regStep) {
        case 1:
          return regEmail.length > 3 && regPassword.length >= 6 && regPassword === regPasswordConfirm;
        case 2:
          return regFirstName.trim().length > 0 && regLastName.trim().length > 0 && regCity.trim().length > 0;
        case 3:
          return regLanguages.length > 0;
        case 4:
          if (regPracticeMode === 'new') return regPracticeName.trim().length > 0 && regPracticeCity.trim().length > 0;
          if (regPracticeMode === 'existing') return !!regExistingPracticeId;
          return true; // skip
        default:
          return true;
      }
    };

    const renderStepContent = () => {
      switch (regStep) {
        case 1:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Account erstellen</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Erstelle dein Revio-Konto</Text>
              <TextInput value={regEmail} onChangeText={setRegEmail} placeholder="E-Mail-Adresse" placeholderTextColor={c.muted} keyboardType="email-address" autoCapitalize="none" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regPassword} onChangeText={setRegPassword} placeholder="Passwort (mind. 6 Zeichen)" placeholderTextColor={c.muted} secureTextEntry style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regPasswordConfirm} onChangeText={setRegPasswordConfirm} placeholder="Passwort bestätigen" placeholderTextColor={c.muted} secureTextEntry style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              {regPasswordConfirm.length > 0 && regPassword !== regPasswordConfirm && (
                <Text style={{ color: '#E05A77', fontSize: 13, marginTop: -6 }}>Passwörter stimmen nicht überein</Text>
              )}
            </>
          );
        case 2:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Persönliche Angaben</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Erzähl uns etwas über dich</Text>
              <TextInput value={regFirstName} onChangeText={setRegFirstName} placeholder="Vorname" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regLastName} onChangeText={setRegLastName} placeholder="Nachname" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regCity} onChangeText={setRegCity} placeholder="Stadt (z. B. Köln)" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regBio} onChangeText={setRegBio} placeholder="Kurze Vorstellung…" placeholderTextColor={c.muted} multiline numberOfLines={4} style={[styles.regInput, styles.regTextarea, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            </>
          );
        case 3:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Fachliches Profil</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Spezialisierungen, Sprachen & mehr</Text>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Spezialisierungen <Text style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(optional)</Text></Text>
              <View style={styles.tagRow}>
                {regSpecOptions.map(s => {
                  const active = regSpecializations.includes(s);
                  return (
                    <Pressable key={s} onPress={() => toggleRegSpec(s)} style={[styles.chip, active ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.card, borderColor: c.border }]}>
                      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : c.text }]}>{s}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 14 }]}>Sprachen</Text>
              <View style={styles.tagRow}>
                {languageOptions.map(l => {
                  const active = regLanguages.includes(l);
                  return (
                    <Pressable key={l} onPress={() => toggleRegLang(l)} style={[styles.chip, active ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.card, borderColor: c.border }]}>
                      <Text style={[styles.chipText, { color: active ? '#FFFFFF' : c.text }]}>{l}</Text>
                    </Pressable>
                  );
                })}
                {regLanguages.filter(l => !languageOptions.includes(l)).map(l => (
                  <Pressable key={l} onPress={() => toggleRegLang(l)} style={[styles.chip, { backgroundColor: c.primary, borderColor: c.primary }]}>
                    <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{l} ✕</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
                <TextInput
                  value={regCustomLanguage}
                  onChangeText={setRegCustomLanguage}
                  placeholder="Andere Sprache (z. B. Farsi, Vietn.)"
                  placeholderTextColor={c.muted}
                  style={[styles.regInput, { flex: 1, backgroundColor: c.card, borderColor: c.border, color: c.text, paddingVertical: 8 }]}
                />
                <Pressable
                  onPress={() => {
                    const lang = regCustomLanguage.trim().toUpperCase().slice(0, 5);
                    if (lang && !regLanguages.includes(lang)) {
                      setRegLanguages(prev => [...prev, lang]);
                      setRegCustomLanguage('');
                    }
                  }}
                  style={[styles.kassenartBtn, { backgroundColor: c.primary, borderColor: c.primary, paddingHorizontal: 18 }]}
                >
                  <Text style={[styles.kassenartText, { color: '#FFFFFF' }]}>＋</Text>
                </Pressable>
              </View>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 14 }]}>Fortbildungen <Text style={{ fontWeight: '400', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(Checkliste)</Text></Text>
              {fortbildungOptions.map(opt => {
                const checked = regFortbildungen.includes(opt.key);
                return (
                  <Pressable key={opt.key} onPress={() => toggleRegFort(opt.key)} style={styles.checkRow}>
                    <View style={[styles.checkbox, { borderColor: checked ? c.primary : c.border, backgroundColor: checked ? c.primary : 'transparent' }]}>
                      {checked && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.checkLabel, { color: c.text }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
              <View style={[styles.switchRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchTitle, { color: c.text }]}>Hausbesuche</Text>
                  <Text style={[styles.switchLabel, { color: c.muted }]}>Du bist bereit, Patienten zu Hause zu behandeln</Text>
                </View>
                <Switch value={regHomeVisit} onValueChange={setRegHomeVisit} trackColor={{ true: c.success }} />
              </View>
            </>
          );
        case 4:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Praxis verbinden</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>In welcher Praxis arbeitest du? (optional)</Text>

              <View style={styles.kassenartRow}>
                {[
                  { key: 'new', label: '＋ Neue Praxis' },
                  { key: 'existing', label: '🔗 Bestehende' },
                  { key: 'skip', label: 'Überspringen' },
                ].map(opt => {
                  const active = regPracticeMode === opt.key;
                  return (
                    <Pressable key={opt.key} onPress={() => setRegPracticeMode(opt.key)}
                      style={[styles.kassenartBtn, active ? { backgroundColor: c.primary, borderColor: c.primary } : { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                      <Text style={[styles.kassenartText, { color: active ? '#FFFFFF' : c.text }]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {regPracticeMode === 'new' && (
                <>
                  <TextInput value={regPracticeName} onChangeText={setRegPracticeName} placeholder="Praxisname" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
                  <TextInput value={regPracticeAddress} onChangeText={setRegPracticeAddress} placeholder="Straße und Hausnummer" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
                  <TextInput value={regPracticeCity} onChangeText={setRegPracticeCity} placeholder="Stadt (z. B. Köln)" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
                  <TextInput value={regPracticePhone} onChangeText={setRegPracticePhone} placeholder="Telefonnummer" placeholderTextColor={c.muted} keyboardType="phone-pad" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
                </>
              )}

              {regPracticeMode === 'existing' && (
                <>
                  <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                    <Text style={styles.noticeIcon}>ℹ️</Text>
                    <Text style={[styles.noticeBody, { color: c.muted }]}>
                      Suche nach der Praxis. Der Praxis-Admin muss deine Anfrage anschließend bestätigen.
                    </Text>
                  </View>
                  <TextInput
                    value={regExistingPracticeName}
                    onChangeText={async (text) => {
                      setRegExistingPracticeName(text);
                      setRegExistingPracticeId(null);
                      if (text.length < 2) { setRegPracticeSearchResults([]); return; }
                      setRegPracticeSearching(true);
                      try {
                        const res = await fetch(`${getBaseUrl()}/practices/search?q=${encodeURIComponent(text)}`);
                        if (res.ok) { const d = await res.json(); setRegPracticeSearchResults(d.practices ?? []); }
                      } catch { /* ignore */ } finally { setRegPracticeSearching(false); }
                    }}
                    placeholder="Praxisname oder Stadt suchen…"
                    placeholderTextColor={c.muted}
                    style={[styles.regInput, { backgroundColor: c.card, borderColor: regExistingPracticeId ? c.primary : c.border, color: c.text }]}
                  />
                  {regPracticeSearching && <Text style={[styles.regStepSub, { color: c.muted }]}>Suche…</Text>}
                  {regPracticeSearchResults.length > 0 && !regExistingPracticeId && (
                    <View style={[{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: c.border, marginTop: 4 }]}>
                      {regPracticeSearchResults.map((p, i) => (
                        <Pressable
                          key={p.id}
                          onPress={() => { setRegExistingPracticeId(p.id); setRegExistingPracticeName(`${p.name} – ${p.city}`); setRegPracticeSearchResults([]); }}
                          style={[{ padding: 12, backgroundColor: c.card, borderTopWidth: i > 0 ? 1 : 0, borderColor: c.border }]}
                        >
                          <Text style={[styles.practiceName, { color: c.text }]}>{p.name}</Text>
                          <Text style={[styles.practiceCity, { color: c.muted }]}>{p.city}{p.address ? ` · ${p.address}` : ''}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {regExistingPracticeId && (
                    <View style={[styles.noticeBox, { backgroundColor: c.successBg, borderColor: c.success }]}>
                      <Text style={styles.noticeIcon}>✅</Text>
                      <Text style={[styles.noticeBody, { color: c.success }]}>Praxis ausgewählt. Anfrage wird nach Registrierung gestellt.</Text>
                    </View>
                  )}
                </>
              )}

              {regPracticeMode === 'skip' && (
                <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                  <Text style={styles.noticeIcon}>✓</Text>
                  <Text style={[styles.noticeBody, { color: c.muted }]}>
                    Du kannst eine Praxis später in deinen Profileinstellungen hinzufügen.
                  </Text>
                </View>
              )}
            </>
          );
        case 5:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Vorschau & Einreichen</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Überprüfe deine Angaben vor dem Einreichen</Text>
              {[
                { label: 'Name', value: `${regFirstName} ${regLastName}`.trim() || '—' },
                { label: 'E-Mail', value: regEmail || '—' },
                { label: 'Stadt', value: regCity || '—' },
                { label: 'Spezialisierungen', value: regSpecializations.join(', ') || '—' },
                { label: 'Sprachen', value: regLanguages.join(', ') || '—' },
                { label: 'Hausbesuche', value: regHomeVisit ? 'Ja' : 'Nein' },
                { label: 'Praxis', value: regPracticeMode === 'new' ? (regPracticeName || '—') : regPracticeMode === 'existing' ? (regExistingPracticeName || '—') : 'Keine Praxis' },
                ...(regPracticeMode === 'new' ? [{ label: 'Adresse', value: [regPracticeAddress, regPracticeCity].filter(Boolean).join(', ') || '—' }] : []),
              ].map(row => (
                <View key={row.label} style={[styles.previewRow, { borderBottomColor: c.border }]}>
                  <Text style={[styles.previewLabel, { color: c.muted }]}>{row.label}</Text>
                  <Text style={[styles.previewValue, { color: c.text }]}>{row.value}</Text>
                </View>
              ))}
              {regBio ? (
                <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border, marginTop: 4 }]}>
                  <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Über mich</Text>
                  <Text style={[styles.infoBody, { color: c.text, fontSize: 14 }]}>{regBio}</Text>
                </View>
              ) : null}
              <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border }]}>
                <Text style={styles.noticeIcon}>ℹ️</Text>
                <Text style={[styles.noticeBody, { color: c.muted }]}>
                  Dein Profil wird nach dem Einreichen manuell geprüft. Den Status kannst du jederzeit in der App einsehen.
                </Text>
              </View>
            </>
          );
        default:
          return null;
      }
    };

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => { if (regStep === 1) setShowRegister(false); else setRegStep(s => s - 1); }}
          style={styles.backBtn}
        >
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {regStep === 1 ? 'Abbrechen' : t('backBtn')}</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
            <Text style={styles.logoText}>R</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]}>Registrierung</Text>
            <Text style={[styles.headerSub, { color: c.muted }]}>Schritt {regStep} von {REG_STEPS}</Text>
          </View>
        </View>

        {renderProgress()}

        {renderStepContent()}

        <Pressable
          style={[styles.registerBtn, { backgroundColor: canProceed() ? c.primary : c.border, marginTop: 8 }]}
          onPress={async () => {
            if (regStep < REG_STEPS) {
              setRegStep(s => s + 1);
            } else {
              try {
                const res = await fetch(`${getBaseUrl()}/register/therapist`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: regEmail,
                    password: regPassword,
                    fullName: `${regFirstName} ${regLastName}`.trim(),
                    professionalTitle: 'Physiotherapeut/in',
                    city: regCity,
                    bio: regBio || undefined,
                    homeVisit: regHomeVisit,
                    specializations: regSpecializations.length > 0 ? regSpecializations : ['Physiotherapie'],
                    languages: regLanguages.length > 0 ? regLanguages.map(l => l.toLowerCase()) : ['de'],
                    certifications: regFortbildungen,
                    ...(regPracticeMode === 'new' ? {
                      practice: {
                        name: regPracticeName || 'Eigene Praxis',
                        city: regPracticeCity || regCity,
                        address: regPracticeAddress || undefined,
                        phone: regPracticePhone || undefined,
                      },
                    } : regPracticeMode === 'existing' && regExistingPracticeId ? {
                      existingPracticeId: regExistingPracticeId,
                    } : {}),
                  }),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  alert(err.message ?? 'Fehler beim Einreichen. Bitte versuche es erneut.');
                  return;
                }
              } catch {
                alert('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
                return;
              }
              setRegSubmitted(true);
            }
          }}
        >
          <Text style={styles.registerBtnText}>
            {regStep < REG_STEPS ? 'Weiter →' : 'Profil einreichen'}
          </Text>
        </Pressable>
      </ScrollView>
    );
  };

  // ── Invite Claim Screen ───────────────────────────────────────────────────

  const handleVisibilityChoice = async (preference) => {
    if (!authToken) return;
    setVisibilityLoading(true);
    try {
      const res = await fetch(`${getBaseUrl()}/invite/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ visibilityPreference: preference }),
      });
      const data = await res.json().catch(() => ({}));
      setShowVisibilityModal(false);
      if (res.ok) {
        // Refresh profile
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (profileRes.ok) setLoggedInTherapist(await profileRes.json());

        if (preference === 'visible') {
          if (data.isPublished) {
            Alert.alert('Profil sichtbar', 'Dein Profil ist jetzt öffentlich sichtbar.');
          } else if (data.missingFields && data.missingFields.length > 0) {
            const fields = data.missingFields.join(', ');
            Alert.alert(
              'Profil unvollständig',
              `Bevor dein Profil sichtbar wird, fülle bitte noch folgende Felder aus: ${fields}`,
              [{ text: 'Profil bearbeiten', onPress: () => setActiveTab('therapist') }, { text: 'Später', style: 'cancel' }]
            );
          }
        } else {
          Alert.alert('Profil versteckt', 'Dein Profil ist jetzt nicht öffentlich sichtbar.');
        }
      } else {
        Alert.alert('Fehler', data.message ?? 'Einstellung konnte nicht gespeichert werden.');
      }
    } catch {
      setShowVisibilityModal(false);
      Alert.alert('Verbindungsfehler', 'Bitte prüfe deine Internetverbindung.');
    } finally {
      setVisibilityLoading(false);
    }
  };

  const renderInviteClaimScreen = () => {
    if (inviteClaimLoading && !inviteClaimData) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background }}>
          <Text style={{ color: c.muted, fontSize: 15 }}>Einladung wird geprüft…</Text>
        </View>
      );
    }

    if (inviteClaimError && !inviteClaimData) {
      return (
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}>
          <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 40 }]}>
            <Ionicons name="alert-circle-outline" size={40} color="#E74C3C" style={{ alignSelf: 'center' }} />
            <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center' }]}>Ungültige Einladung</Text>
            <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>{inviteClaimError}</Text>
            <Pressable
              style={[styles.registerBtn, { backgroundColor: c.primary, marginTop: 8 }]}
              onPress={() => { setShowInviteClaim(false); setInviteClaimError(''); }}
            >
              <Text style={styles.registerBtnText}>Zur App</Text>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    if (!inviteClaimData) return null;

    const { therapist: inviteTherapist, practice: invitePractice } = inviteClaimData;

    const handleClaim = async () => {
      if (!inviteClaimPassword || inviteClaimPassword.length < 6) {
        setInviteClaimError('Das Passwort muss mindestens 6 Zeichen lang sein.');
        return;
      }
      if (inviteClaimPassword !== inviteClaimPasswordConfirm) {
        setInviteClaimError('Die Passwörter stimmen nicht überein.');
        return;
      }
      setInviteClaimLoading(true);
      setInviteClaimError('');
      try {
        const res = await fetch(`${getBaseUrl()}/invite/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: inviteClaimToken, password: inviteClaimPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setInviteClaimError(data.message ?? 'Fehler beim Aktivieren des Kontos.');
          return;
        }
        // Store token and load profile
        await AsyncStorage.setItem('revio_auth_token', data.token);
        setAuthToken(data.token);
        const profileRes = await fetch(`${getBaseUrl()}/auth/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        });
        if (profileRes.ok) setLoggedInTherapist(await profileRes.json());
        setShowInviteClaim(false);
        setInviteClaimToken(null);
        setInviteClaimData(null);
        setInviteClaimPassword('');
        setInviteClaimPasswordConfirm('');
        // Show visibility modal
        setShowVisibilityModal(true);
      } catch {
        setInviteClaimError('Verbindungsfehler. Bitte prüfe deine Internetverbindung.');
      } finally {
        setInviteClaimLoading(false);
      }
    };

    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border, marginTop: 20, alignItems: 'center' }]}>
          <View style={[styles.logoMark, { backgroundColor: c.primary, width: 56, height: 56, borderRadius: 16 }]}>
            <Text style={[styles.logoText, { fontSize: 24 }]}>R</Text>
          </View>
          <Text style={[styles.infoTitle, { color: c.text, textAlign: 'center', marginTop: 8 }]}>Du wurdest eingeladen!</Text>
          <Text style={[styles.infoBody, { color: c.muted, textAlign: 'center' }]}>
            {invitePractice.name} hat ein Profil für dich erstellt. Setze jetzt ein Passwort, um dein Konto zu aktivieren.
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>DEIN PROFIL</Text>
          <Text style={[styles.detailInfoValue, { color: c.text, fontWeight: '700', fontSize: 17 }]}>{inviteTherapist.fullName}</Text>
          <Text style={[styles.detailInfoValue, { color: c.muted }]}>{inviteTherapist.professionalTitle}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Ionicons name="business-outline" size={14} color={c.muted} />
            <Text style={[styles.detailInfoValue, { color: c.muted }]}>{invitePractice.name}, {invitePractice.city}</Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>PASSWORT SETZEN</Text>
          <TextInput
            style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 6 }]}
            value={inviteClaimPassword}
            onChangeText={setInviteClaimPassword}
            placeholder="Passwort (mind. 6 Zeichen)"
            placeholderTextColor={c.muted}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.regInput, { color: c.text, borderColor: c.border, backgroundColor: c.mutedBg, marginTop: 10 }]}
            value={inviteClaimPasswordConfirm}
            onChangeText={setInviteClaimPasswordConfirm}
            placeholder="Passwort wiederholen"
            placeholderTextColor={c.muted}
            secureTextEntry
            autoCapitalize="none"
          />
          {!!inviteClaimError && (
            <Text style={{ color: '#E74C3C', fontSize: 13, marginTop: 8 }}>{inviteClaimError}</Text>
          )}
          <Pressable
            style={[styles.registerBtn, { backgroundColor: inviteClaimLoading ? c.border : c.primary, marginTop: 16 }]}
            onPress={handleClaim}
            disabled={inviteClaimLoading}
          >
            <Text style={styles.registerBtnText}>{inviteClaimLoading ? 'Aktivieren…' : 'Konto aktivieren'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  const renderTab = () => {
    if (showInviteClaim) return renderInviteClaimScreen();
    if (selectedTherapist) return renderTherapistProfile(selectedTherapist);
    if (selectedPractice) return renderPracticeProfile(selectedPractice);
    if (showCreatePractice) return renderCreatePractice();
    if (showPracticeSearch) return renderPracticeSearch();
    if (showInvitePage) return renderInvitePage();
    if (showPracticeAdmin) return renderPracticeAdmin();
    if (showRegister) return renderRegister();
    if (activeTab === 'favorites') return renderFavorites();
    if (activeTab === 'therapist') {
      if (loggedInTherapist) return renderTherapistDashboard();
      if (showLogin) return renderLogin();
      return renderTherapist();
    }
    if (activeTab === 'options') return renderOptions();
    return renderDiscover();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

      {/* ── Notification Sheet ──────────────────────────────────────────────── */}
      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowNotifications(false)} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, minHeight: 200 }}>
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 16 }}>Benachrichtigungen</Text>
          {notifications.length === 0 ? (
            <Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>Keine neuen Benachrichtigungen</Text>
          ) : (
            notifications.map((n) => (
              <View key={n.id} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#E74C3C', marginTop: 5 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 14, lineHeight: 20 }}>{n.message}</Text>
                  <Text style={{ color: c.muted, fontSize: 11, marginTop: 3 }}>
                    {new Date(n.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </Modal>

      {/* ── Visibility Modal ───────────────────────────────────────────────── */}
      <Modal visible={showVisibilityModal} transparent animationType="fade" onRequestClose={() => setShowVisibilityModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }} onPress={() => setShowVisibilityModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 24, gap: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: c.text, textAlign: 'center' }}>Profil sichtbar machen?</Text>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', lineHeight: 20 }}>
                Soll dein Profil öffentlich sichtbar sein? Du kannst das jederzeit ändern.
              </Text>
              <Pressable
                style={{ backgroundColor: c.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: visibilityLoading ? 0.6 : 1 }}
                onPress={() => handleVisibilityChoice('visible')}
                disabled={visibilityLoading}
              >
                <Ionicons name="eye-outline" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Sichtbar</Text>
              </Pressable>
              <Pressable
                style={{ backgroundColor: c.mutedBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: c.border, opacity: visibilityLoading ? 0.6 : 1 }}
                onPress={() => handleVisibilityChoice('hidden')}
                disabled={visibilityLoading}
              >
                <Ionicons name="eye-off-outline" size={20} color={c.text} />
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>Versteckt</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Location Sheet ─────────────────────────────────────────────────── */}
      <Modal visible={showLocationSheet} transparent animationType="slide" onRequestClose={() => setShowLocationSheet(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={() => setShowLocationSheet(false)} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, gap: 16 }}>
          <View style={{ width: 36, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 }} />
          <Text style={{ fontSize: 20, fontWeight: '700', color: c.text, textAlign: 'center' }}>{t('locationTitle')}</Text>
          <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', marginTop: -8 }}>
            {t('locationSub')}
          </Text>

          {/* GPS Button */}
          <Pressable
            onPress={handleLocationSheetGPS}
            disabled={locationLoading}
            style={{ backgroundColor: c.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <Ionicons name="navigate-sharp" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {locationLoading ? t('gpsLoading') : t('useGPS')}
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            <Text style={{ color: c.muted, fontSize: 12 }}>{t('locationDivider')}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
          </View>

          {/* Manual input with autocomplete */}
          <View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={locationSheetCity}
                onChangeText={fetchLocationSuggestions}
                placeholder="z.B. Hauptstraße 5, München"
                placeholderTextColor={c.muted}
                style={{ flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: locationSuggestions.length > 0 ? c.primary : c.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 15 }}
                onSubmitEditing={handleLocationSheetManual}
                returnKeyType="search"
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Pressable
                onPress={handleLocationSheetManual}
                style={{ backgroundColor: locationSheetCity.trim() ? c.primary : c.mutedBg, borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' }}
              >
                <Text style={{ color: locationSheetCity.trim() ? '#fff' : c.muted, fontSize: 15, fontWeight: '600' }}>{t('confirmLocation')}</Text>
              </Pressable>
            </View>

            {/* Autocomplete dropdown */}
            {locationSuggestions.length > 0 && (
              <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.primary, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
                {locationSuggestions.map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => selectLocationSuggestion(s)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12,
                      borderBottomWidth: i < locationSuggestions.length - 1 ? 1 : 0, borderBottomColor: c.border }}
                  >
                    <Ionicons name="navigate-sharp" size={14} color="#2b6877" />
                    <Text style={{ flex: 1, color: c.text, fontSize: 14 }} numberOfLines={2}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.appFrame}>
        {renderTab()}
      </View>

      {/* Bottom nav */}
      <View style={[styles.navbar, { backgroundColor: c.nav, borderColor: c.border }]}>
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setSelectedPractice(null);
                setSelectedTherapist(null);
                setShowRegister(false);
                setShowCreatePractice(false);
                setShowPracticeSearch(false);
                setShowPracticeAdmin(false);
                setShowInvitePage(false);
                if (tab.key === 'discover') {
                  setQuery('');
                  setActiveChip(null);
                  setResults([]);
                  setSearched(false);
                  setShowAutocomplete(false);
                  setShowFilters(false);
                }
                setActiveTab(tab.key);
              }}
              style={styles.navItem}
            >
              <View style={[styles.navPill, active && { backgroundColor: c.primary }]}>
                <Text style={[styles.navIcon, { color: active ? '#FFFFFF' : c.muted }]}>
                  {tab.icon}
                </Text>
              </View>
              <Text style={[styles.navLabel, { color: active ? c.primary : c.muted }]}>
                {t(tab.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  appFrame: { flex: 1 },
  scrollContent: { padding: 20, gap: 14 },

  // Hero
  hero: { paddingTop: 8, paddingBottom: 4, gap: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', lineHeight: 36 },
  heroSub: { fontSize: 15, lineHeight: 22 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 4 },
  logoMark: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  brandName: { fontSize: 24, fontWeight: '700', letterSpacing: 3, marginLeft: 4 },
  logoContainer: { backgroundColor: '#506d7a', padding: 10, borderRadius: 12 },
  logoImage: { width: 80, height: 80, resizeMode: 'contain' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 1 },

  // Search box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 0,
    height: 52,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 16 },
  searchDivider: { width: 1, height: 24, opacity: 0.5 },
  searchFilterArea: { paddingHorizontal: 12, paddingVertical: 14, position: 'relative' },

  // Autocomplete
  autocompleteBox: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -4,
    paddingTop: 4,
    overflow: 'hidden'
  },
  acItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  acSearchIcon: { fontSize: 14 },
  acItemText: { fontSize: 15 },

  // Chips
  chipsRow: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 14, fontWeight: '500' },

  // Filter row
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cityInput: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15
  },
  filterBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  filterBtnText: { fontSize: 14, fontWeight: '600' },
  goBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  goBtnText: { fontSize: 18, fontWeight: '700', color: '#1B1F23' },

  // Filter panel
  filterPanel: { borderWidth: 1, borderRadius: 16, padding: 16 },
  filterSectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  kassenartRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kassenartBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  kassenartText: { fontSize: 13, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  checkLabel: { fontSize: 14 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  switchTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  switchLabel: { fontSize: 13, lineHeight: 18 },

  // Section row
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 16, fontWeight: '700' },
  approvedPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  approvedPillText: { fontSize: 12, fontWeight: '600' },

  // Result cards
  resultCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  cardName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  cardTitle: { fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 13, fontWeight: '500' },
  practiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 10
  },
  practiceInitial: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center'
  },
  practiceInitialText: { fontSize: 16, fontWeight: '700' },
  practiceName: { fontSize: 14, fontWeight: '600' },
  practiceCity: { fontSize: 12, marginTop: 1 },
  practiceArrow: { fontSize: 18 },
  filterIconBtn: {
    width: 48, height: 48, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center'
  },
  filterIconText: { fontSize: 20 },
  filterBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center'
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  distBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 },
  distBadgeText: { fontSize: 12, fontWeight: '700' },

  // Practice profile screen
  backBtn: { paddingVertical: 4 },
  backBtnText: { fontSize: 16, fontWeight: '600' },
  practiceHeader: { borderWidth: 1, borderRadius: 20, padding: 20, alignItems: 'center', gap: 6 },
  practiceLogoLarge: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4
  },
  practiceLogoText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  practiceLogoCross: { position: 'absolute', top: 8, right: 8, width: 18, height: 18 },
  plusBarH: { position: 'absolute', top: '38%', left: 0, right: 0, height: 5, borderRadius: 3 },
  plusBarV: { position: 'absolute', left: '38%', top: 0, bottom: 0, width: 5, borderRadius: 3 },
  practiceHeaderName: { fontSize: 20, fontWeight: '700' },
  practiceHeaderCity: { fontSize: 14 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12
  },
  detailIcon: { fontSize: 18 },
  detailText: { fontSize: 14, flex: 1, lineHeight: 20 },
  miniCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderRadius: 16, padding: 14
  },
  miniAvatar: { width: 44, height: 44, borderRadius: 22 },

  ctaBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: '#1B1F23' },

  // Empty state
  emptyState: { borderWidth: 1, borderRadius: 20, padding: 32, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Therapist tab
  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderRadius: 16, padding: 14,
    width: '100%'
  },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F9FA',
    marginTop: 1,
  },
  noticeIcon: { fontSize: 20, marginTop: 1, width: 24, textAlign: 'center' },
  noticeTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  noticeBody: { fontSize: 13, lineHeight: 18, flex: 1, flexShrink: 1 },
  infoCard: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 8 },
  infoTitle: { fontSize: 20, fontWeight: '700' },
  infoBody: { fontSize: 15, lineHeight: 22 },
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderBottomWidth: 1, paddingBottom: 14
  },
  stepNum: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  stepTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  stepBody: { fontSize: 13, lineHeight: 18 },
  registerBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  registerBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  loginLink: { textAlign: 'center', fontSize: 14, fontWeight: '600', paddingVertical: 12 },

  // Options rows
  optionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14
  },
  optionLabel: { fontSize: 15, fontWeight: '500' },
  optionValue: { fontSize: 14 },

  // Therapist profile
  therapistAvatarLarge: { width: 80, height: 80, borderRadius: 40, marginBottom: 4 },
  therapistAvatarSmall: { width: 40, height: 40 },
  practiceHeaderInitial: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  practiceHeaderInitialText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  infoSection: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  verifiedBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { fontSize: 12, fontWeight: '700' },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailInfoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailInfoValue: { fontSize: 14, marginTop: 1 },

  // Theme toggle
  themeToggleRow: { flexDirection: 'row', gap: 6 },
  themeBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  themeBtnText: { fontSize: 13, fontWeight: '600' },

  // Bottom nav
  navbar: {
    borderTopWidth: 1, flexDirection: 'row',
    justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 8
  },
  navItem: { alignItems: 'center', gap: 4, flex: 1, paddingVertical: 4 },
  navPill: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 6 },
  navIcon: { fontSize: 18, fontWeight: '700' },
  navLabel: { fontSize: 11, fontWeight: '600' },

  // Registration stepper
  regProgressRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  regProgressBar: { height: 4, borderRadius: 2, flex: 1 },
  regStepTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  regStepSub: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  regInput: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15
  },
  regTextarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },

  // Preview step
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, gap: 12
  },
  previewLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  previewValue: { fontSize: 13, flex: 2, textAlign: 'right' }
});
