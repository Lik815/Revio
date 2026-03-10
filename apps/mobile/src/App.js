import React, { useState, useEffect } from 'react';
import {
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
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

// ─── Autocomplete suggestions ─────────────────────────────────────────────────

const allSuggestions = [
  'Rückenschmerzen', 'Knieschmerzen', 'Sportverletzung', 'Schulter',
  'Nacken', 'Hüfte', 'Fuß', 'Arm', 'Hand', 'Neurologisch',
  'Wirbelsäule', 'Bandscheibe', 'Manualtherapie', 'Sportreha',
  'Orthopädie', 'Post-OP-Reha', 'Schlaganfall-Reha', 'Neurologie',
  'Parkinson', 'MS', 'Kinder-Physio', 'Schwangerschaft', 'Beckenboden',
  'Ergonomie', 'Laufen', 'Fußball', 'Haltung', 'Entwicklung',
  'Bobath', 'PNF', 'MLD', 'KGG', 'Lymphdrainage'
];

// ─── Quick-chip labels ────────────────────────────────────────────────────────

const quickChips = [
  { label: 'Rückenschmerzen', keywords: ['rücken', 'rückenschmerzen', 'wirbelsäule', 'bandscheibe', 'haltung'] },
  { label: 'Knieschmerzen',   keywords: ['knie', 'knieschmerzen', 'laufen', 'lauf'] },
  { label: 'Sportverletzung', keywords: ['sport', 'sportverletzung', 'sportreha', 'fußball', 'muskeln'] },
  { label: 'Neurologisch',    keywords: ['neurologie', 'neurologisch', 'schlaganfall', 'ms', 'parkinson', 'bobath', 'pnf'] },
  { label: 'Schulter',        keywords: ['schulter', 'nacken', 'arm', 'hand'] }
];

// ─── Nav tabs ─────────────────────────────────────────────────────────────────

const tabs = [
  { key: 'discover',  label: 'Suchen',    icon: '⌕' },
  { key: 'favorites', label: 'Favoriten', icon: '♡' },
  { key: 'therapist', label: 'Therapeuten', icon: '＋' },
  { key: 'options',   label: 'Optionen',  icon: '☰' }
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
  'Rückenschmerzen', 'Knieschmerzen', 'Schulter', 'Nacken', 'Hüfte', 'Fuß',
  'Sportverletzung', 'Sportreha', 'Orthopädie', 'Neurologie', 'Manualtherapie',
  'Post-OP-Reha', 'Kinder-Physio', 'Schwangerschaft', 'Beckenboden',
  'Wirbelsäule', 'Bandscheibe', 'Ergonomie', 'Schlaganfall-Reha'
];
const languageOptions = ['DE', 'EN', 'TR', 'AR', 'FR', 'ES', 'IT', 'PL', 'RU'];
const REG_STEPS = 6;

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
  { id: 't1',  fullName: 'Anna Becker',       professionalTitle: 'Physiotherapeutin', specializations: ['Rückenschmerzen', 'Sport'],         languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['MT', 'KGG'],     photo: 'https://i.pravatar.cc/96?img=1',  practices: [practices[0]], verifiziert: true,  bio: 'Ich helfe Menschen, ihren Rücken dauerhaft zu entlasten – mit gezielter Therapie und bewegungsbasierter Prävention.', behandlungsbereiche: ['Orthopädie', 'Sportphysio'],          verfügbareZeiten: 'Mo–Fr 8–17 Uhr',          website: '' },
  { id: 't2',  fullName: 'Markus Stein',      professionalTitle: 'Physiotherapeut',   specializations: ['Neurologie', 'Orthopädie'],         languages: ['DE'],       homeVisit: false, kassenart: 'privat',       fortbildungen: ['Bobath', 'MT'],  photo: 'https://i.pravatar.cc/96?img=3',  practices: [practices[0]], verifiziert: true,  bio: 'Mein Schwerpunkt liegt in der neurologischen Rehabilitation – von Schlaganfall bis MS.',                              behandlungsbereiche: ['Neurologie', 'Orthopädie'],           verfügbareZeiten: 'Mo–Do 9–18 Uhr',          website: 'www.markusstein-physio.de' },
  { id: 't3',  fullName: 'Julia Hoffmann',    professionalTitle: 'Physiotherapeutin', specializations: ['Knieschmerzen', 'Sportreha'],       languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['KGG'],           photo: 'https://i.pravatar.cc/96?img=5',  practices: [practices[1]], verifiziert: true,  bio: 'Spezialisiert auf Knie- und Sportverletzungen – ich begleite dich von der Diagnose bis zurück in den Sport.',         behandlungsbereiche: ['Sportphysio', 'Orthopädie'],          verfügbareZeiten: 'Mo–Fr 7–16 Uhr',          website: '' },
  { id: 't4',  fullName: 'Thomas Müller',     professionalTitle: 'Physiotherapeut',   specializations: ['Wirbelsäule', 'Manualtherapie'],    languages: ['DE'],       homeVisit: false, kassenart: 'gesetzlich',   fortbildungen: ['MT', 'MLD'],     photo: 'https://i.pravatar.cc/96?img=7',  practices: [practices[1]], verifiziert: true,  bio: 'Manuelle Therapie ist meine Leidenschaft – ich behandle komplexe Wirbelsäulenbeschwerden mit Präzision.',             behandlungsbereiche: ['Orthopädie', 'Manuelle Therapie'],    verfügbareZeiten: 'Di–Sa 8–18 Uhr',          website: '' },
  { id: 't5',  fullName: 'Sarah Schneider',   professionalTitle: 'Physiotherapeutin', specializations: ['Schulter', 'Nacken'],               languages: ['DE', 'TR'], homeVisit: false, kassenart: 'selbstzahler', fortbildungen: ['MT'],            photo: 'https://i.pravatar.cc/96?img=9',  practices: [practices[2]], verifiziert: true,  bio: 'Schulter- und Nackenbeschwerden sind mein Spezialgebiet – auch für Patienten, die bisher keine Besserung erfahren haben.', behandlungsbereiche: ['Orthopädie'],                         verfügbareZeiten: 'Mo–Fr 10–19 Uhr',         website: '' },
  { id: 't6',  fullName: 'Felix Wagner',      professionalTitle: 'Physiotherapeut',   specializations: ['Sportverletzung', 'Hüfte'],         languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['KGG', 'MT'],     photo: 'https://i.pravatar.cc/96?img=11', practices: [practices[2]], verifiziert: true,  bio: 'Als ehemaliger Leistungssportler kenne ich Sportverletzungen aus erster Hand und behandle sie mit Verständnis.',       behandlungsbereiche: ['Sportphysio', 'Orthopädie'],          verfügbareZeiten: 'Mo–Sa 7–20 Uhr',          website: 'www.felix-sportphysio.de' },
  { id: 't7',  fullName: 'Laura Fischer',     professionalTitle: 'Physiotherapeutin', specializations: ['Neurologie', 'Schlaganfall-Reha'], languages: ['DE'],       homeVisit: true,  kassenart: 'privat',       fortbildungen: ['Bobath', 'MLD'], photo: 'https://i.pravatar.cc/96?img=13', practices: [practices[3]], verifiziert: true,  bio: 'Ich begleite Schlaganfall-Patienten und Menschen mit neurologischen Erkrankungen auf dem Weg zu mehr Selbstständigkeit.', behandlungsbereiche: ['Neurologie'],                         verfügbareZeiten: 'Mo–Fr 8–16 Uhr',          website: '' },
  { id: 't8',  fullName: 'David Weber',       professionalTitle: 'Physiotherapeut',   specializations: ['Rückenschmerzen', 'Beckenboden'],   languages: ['DE', 'FR'], homeVisit: false, kassenart: 'gesetzlich',   fortbildungen: ['MLD', 'KGG'],    photo: 'https://i.pravatar.cc/96?img=15', practices: [practices[3]], verifiziert: true,  bio: 'Rücken- und Beckenbodentherapie – ich behandle ganzheitlich und erkläre dir, was in deinem Körper passiert.',          behandlungsbereiche: ['Orthopädie', 'Beckengesundheit'],     verfügbareZeiten: 'Mo–Do 8–18 Uhr',          website: '' },
  { id: 't9',  fullName: 'Nina Schäfer',      professionalTitle: 'Physiotherapeutin', specializations: ['Kinder-Physio', 'Entwicklung'],     languages: ['DE', 'EN'], homeVisit: true,  kassenart: 'gesetzlich',   fortbildungen: ['Bobath'],        photo: 'https://i.pravatar.cc/96?img=17', practices: [practices[4]], verifiziert: true,  bio: 'Kinder brauchen eine andere Therapie als Erwachsene – ich bin auf pädiatrische Physiotherapie spezialisiert.',         behandlungsbereiche: ['Pädiatrie', 'Neurologie'],            verfügbareZeiten: 'Mo–Fr 8–15 Uhr',          website: '' },
  { id: 't10', fullName: 'Leon Meyer',        professionalTitle: 'Physiotherapeut',   specializations: ['Orthopädie', 'Post-OP-Reha'],       languages: ['DE'],       homeVisit: false, kassenart: 'selbstzahler', fortbildungen: ['MT', 'KGG'],     photo: 'https://i.pravatar.cc/96?img=19', practices: [practices[4]], verifiziert: true,  bio: 'Postoperative Rehabilitation ist mein Schwerpunkt – ich begleite dich sicher zurück in deinen Alltag.',               behandlungsbereiche: ['Orthopädie', 'Post-OP-Reha'],         verfügbareZeiten: 'Di–Sa 9–18 Uhr',          website: 'www.leon-physio.de' },
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

const BASE_URL = 'http://localhost:4000';
const getBaseUrl = () => BASE_URL;

// ─── Map API therapist → UI format ────────────────────────────────────────────

const mapApiTherapist = (t) => ({
  id: t.id,
  fullName: t.fullName,
  professionalTitle: t.professionalTitle,
  specializations: t.specializations ?? [],
  languages: (t.languages ?? []).map(l => l.toUpperCase()),
  homeVisit: t.homeVisit ?? false,
  city: t.city,
  bio: t.bio ?? '',
  kassenart: null,
  fortbildungen: t.certifications ?? [],
  verifiziert: true,
  behandlungsbereiche: t.specializations ?? [],
  verfügbareZeiten: '',
  website: '',
  photo: `https://i.pravatar.cc/96?u=${t.id}`,
  practices: (t.practices ?? []).map(p => ({
    id: p.id,
    name: p.name,
    city: p.city,
    address: p.address ?? '',
    phone: p.phone ?? '',
    lat: p.lat,
    lng: p.lng,
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

export default function App() {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState('light'); // 'light' | 'dark' | 'system'
  const scheme = themeMode === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : themeMode;
  const c = palette[scheme];

  const [activeTab, setActiveTab] = useState('discover');
  const [selectedPractice, setSelectedPractice] = useState(null);
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

  // GPS: auto-fill address on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      if (geo?.city) setCity(geo.city);
      setUserCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  // Search state
  const [query, setQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [activeChip, setActiveChip] = useState(null);
  const [city, setCity] = useState('Köln');
  const [userCoords, setUserCoords] = useState(null);
  const [homeVisit, setHomeVisit] = useState(false);
  const [kassenart, setKassenart] = useState(null);
  const [fortbildungen, setFortbildungen] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allApiTherapists, setAllApiTherapists] = useState([]);

  const [searched, setSearched] = useState(false);

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

  const runSearchWith = async (q, coords) => {
    setShowAutocomplete(false);
    setSearched(true);
    setSearchLoading(true);
    try {
      const response = await fetch(`${getBaseUrl()}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q || 'physiotherapie',
          city: city || 'Köln',
          homeVisit: homeVisit || undefined,
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

  // ── Discover tab ──────────────────────────────────────────────────────────

  const renderDiscover = () => (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Logo-Zeile */}
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <Text style={[styles.headerTitle, { color: c.text }]}>Revio</Text>
      </View>

      {/* Hero — nur vor erster Suche */}
      {!searched && (
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: c.text }]}>Den richtigen Physio{'\n'}für dein Problem finden.</Text>
          <Text style={[styles.heroSub, { color: c.muted }]}>Geprüfte Physiotherapeuten in Köln — nach Beschwerde suchen, nicht nach Name.</Text>
        </View>
      )}

      {/* Search input + filter icon */}
      <View style={{ zIndex: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <View style={[
            styles.searchBox,
            { backgroundColor: c.card, borderColor: (showAutocomplete && acSuggestions.length > 0) ? c.primary : c.border }
          ]}>
            <Text style={[styles.searchIcon, { color: c.muted }]}>⌕</Text>
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
              placeholder="Wobei brauchst du Hilfe?"
              placeholderTextColor={c.muted}
              style={[styles.searchInput, { color: c.text }]}
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(''); setShowAutocomplete(false); }} hitSlop={8}>
                <Text style={[styles.clearIcon, { color: c.muted }]}>✕</Text>
              </Pressable>
            )}
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

        {/* Filter icon button */}
        <Pressable
          onPress={() => setShowFilters(!showFilters)}
          style={[
            styles.filterIconBtn,
            {
              backgroundColor: showFilters ? c.primary : c.card,
              borderColor: showFilters ? c.primary : c.border
            }
          ]}
        >
          <Text style={[styles.filterIconText, { color: showFilters ? '#FFFFFF' : c.muted }]}>⚙</Text>
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: c.accent }]}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
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

      {/* City input — shown once user starts typing */}
      {(query.length > 0 || searched) && (
        <TextInput
          value={city}
          onChangeText={(text) => { setCity(text); setUserCoords(null); }}
          placeholder="Adresse oder Ort"
          placeholderTextColor={c.muted}
          style={[styles.cityInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]}
        />
      )}

      {/* Expanded filter panel */}
      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: c.card, borderColor: c.border }]}>

          {/* Kassenart */}
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Kassenart</Text>
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
          <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 14 }]}>Fortbildungen</Text>
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
              <Text style={[styles.switchTitle, { color: c.text }]}>Hausbesuche</Text>
              <Text style={[styles.switchLabel, { color: c.muted }]}>Nur Therapeuten mit Hausbesuchen</Text>
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
            {searched ? `${results.length} Ergebnis${results.length !== 1 ? 'se' : ''}` : 'Vorschläge'}
          </Text>
          <View style={[styles.approvedPill, { backgroundColor: c.successBg }]}>
            <Text style={[styles.approvedPillText, { color: c.success }]}>Nur geprüfte Profile</Text>
          </View>
        </View>
      ) : null}

      {/* Result cards */}
      {results.map((t) => (
        <View key={t.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
          {/* Top row: avatar + name — tappable to open profile */}
          <View style={styles.cardTop}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => setSelectedTherapist(t)}>
              <Image source={{ uri: t.photo }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: c.text }]}>{t.fullName}</Text>
                <Text style={[styles.cardTitle, { color: c.muted }]}>{t.professionalTitle}</Text>
              </View>
              <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
            </Pressable>
            <Pressable onPress={() => toggleFavorite(t)} hitSlop={10}>
              <Text style={{ fontSize: 22, color: isFavorite(t.id) ? '#E05A77' : c.muted }}>
                {isFavorite(t.id) ? '♥' : '♡'}
              </Text>
            </Pressable>
          </View>

          {/* Tags: Spezialisierungen + Sprachen + Hausbesuch */}
          <View style={styles.tagRow}>
            {t.specializations.map((s) => (
              <View key={s} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{s}</Text>
              </View>
            ))}
            {t.languages.map((l) => (
              <View key={l} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.muted }]}>{l}</Text>
              </View>
            ))}
            {t.homeVisit && (
              <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                <Text style={[styles.tagText, { color: c.success }]}>Hausbesuch</Text>
              </View>
            )}
          </View>

          {/* Fortbildungen badges */}
          {t.fortbildungen?.length > 0 && (
            <View style={styles.tagRow}>
              {t.fortbildungen.map(f => (
                <View key={f} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                  <Text style={[styles.tagText, { color: c.success }]}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Praxis-Link */}
          {t.practices?.length > 0 && (
            <Pressable
              onPress={() => setSelectedPractice(t.practices[0])}
              style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}
            >
              <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                <Text style={[styles.practiceInitialText, { color: c.muted }]}>
                  {t.practices[0].name.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.practiceName, { color: c.text }]}>{t.practices[0].name}</Text>
                <Text style={[styles.practiceCity, { color: c.muted }]}>{t.practices[0].city}</Text>
              </View>
              {t.distKm != null && (
                <View style={[styles.distBadge, { backgroundColor: c.successBg }]}>
                  <Text style={[styles.distBadgeText, { color: c.success }]}>
                    {formatDist(t.distKm)}
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
              const phone = t.practices?.[0]?.phone;
              if (phone) Linking.openURL(`tel:${phone}`);
            }}
          >
            <Text style={styles.ctaBtnText}>📞 Therapeut kontaktieren</Text>
          </Pressable>
        </View>
      ))}

      {searchLoading && (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.emptyIcon]}>⏳</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Suche läuft…</Text>
        </View>
      )}

      {!searchLoading && results.length === 0 && searched && (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.emptyIcon]}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Keine Ergebnisse</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>
            Versuche einen anderen Suchbegriff oder erweitere den Umkreis.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  // ── Practice profile ──────────────────────────────────────────────────────

  const renderPracticeProfile = (practice) => {
    const therapists = allApiTherapists.filter((t) => t.practices.some((p) => p.id === practice.id));
    return (
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
        <Pressable onPress={() => setSelectedPractice(null)} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ Zurück</Text>
        </Pressable>

        <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.practiceLogoLarge, { backgroundColor: c.primary }]}>
            <Text style={styles.practiceLogoText}>{practice.name.charAt(0)}</Text>
          </View>
          <Text style={[styles.practiceHeaderName, { color: c.text }]}>{practice.name}</Text>
          <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{practice.city}</Text>
        </View>

        {[
          { icon: '📍', label: practice.address, onPress: () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practice.address)}`) },
          { icon: '📞', label: practice.phone, onPress: () => Linking.openURL(`tel:${practice.phone}`) },
          { icon: '🕐', label: practice.hours, onPress: null }
        ].map((row) => (
          <Pressable key={row.label} onPress={row.onPress ?? undefined} style={[styles.detailRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={styles.detailIcon}>{row.icon}</Text>
            <Text style={[styles.detailText, { color: row.onPress ? c.primary : c.text }]}>{row.label}</Text>
          </Pressable>
        ))}

        <Text style={[styles.sectionLabel, { color: c.text, marginTop: 4 }]}>
          Therapeuten ({therapists.length})
        </Text>
        {therapists.map((t) => (
          <View key={t.id} style={[styles.miniCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Image source={{ uri: t.photo }} style={styles.miniAvatar} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: c.text }]}>{t.fullName}</Text>
              <Text style={[styles.cardTitle, { color: c.muted }]}>{t.professionalTitle}</Text>
              <View style={[styles.tagRow, { marginTop: 6 }]}>
                {t.specializations.slice(0, 2).map((s) => (
                  <View key={s} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                    <Text style={[styles.tagText, { color: c.text }]}>{s}</Text>
                  </View>
                ))}
                {t.homeVisit && (
                  <View style={[styles.tag, { backgroundColor: c.successBg }]}>
                    <Text style={[styles.tagText, { color: c.success }]}>Hausbesuch</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ))}

        <Pressable
          style={[styles.ctaBtn, { backgroundColor: c.accent, marginTop: 4 }]}
          onPress={() => { if (practice.phone) Linking.openURL(`tel:${practice.phone}`); }}
        >
          <Text style={styles.ctaBtnText}>📞 Praxis anrufen</Text>
        </Pressable>
      </ScrollView>
    );
  };

  // ── Therapist profile screen ──────────────────────────────────────────────

  const renderTherapistProfile = (t) => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <Pressable onPress={() => setSelectedTherapist(null)} style={styles.backBtn}>
        <Text style={[styles.backBtnText, { color: c.primary }]}>‹ Zurück</Text>
      </Pressable>

      {/* Header */}
      <View style={[styles.practiceHeader, { backgroundColor: c.card, borderColor: c.border }]}>
        <Image source={{ uri: t.photo }} style={styles.therapistAvatarLarge} />
        <View style={styles.profileNameRow}>
          <Text style={[styles.practiceHeaderName, { color: c.text }]}>{t.fullName}</Text>
          {t.verifiziert && (
            <View style={[styles.verifiedBadge, { backgroundColor: c.successBg }]}>
              <Text style={[styles.verifiedText, { color: c.success }]}>✓ Geprüft</Text>
            </View>
          )}
        </View>
        <Text style={[styles.practiceHeaderCity, { color: c.muted }]}>{t.professionalTitle}</Text>
        <View style={[styles.tagRow, { justifyContent: 'center', marginTop: 8 }]}>
          {t.languages.map(l => (
            <View key={l} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
              <Text style={[styles.tagText, { color: c.muted }]}>{l}</Text>
            </View>
          ))}
          {t.homeVisit && (
            <View style={[styles.tag, { backgroundColor: c.successBg }]}>
              <Text style={[styles.tagText, { color: c.success }]}>Hausbesuch</Text>
            </View>
          )}
        </View>
      </View>

      {/* Über mich */}
      {t.bio ? (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Über mich</Text>
          <Text style={[styles.infoBody, { color: c.text, fontSize: 15 }]}>{t.bio}</Text>
        </View>
      ) : null}

      {/* Behandlungsbereiche */}
      {t.behandlungsbereiche?.length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Behandlungsbereiche</Text>
          <View style={styles.tagRow}>
            {t.behandlungsbereiche.map(b => (
              <View key={b} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
                <Text style={[styles.tagText, { color: c.text }]}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Spezialisierungen */}
      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Spezialisierungen</Text>
        <View style={styles.tagRow}>
          {t.specializations.map(s => (
            <View key={s} style={[styles.tag, { backgroundColor: c.mutedBg }]}>
              <Text style={[styles.tagText, { color: c.text }]}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Fortbildungen */}
      {t.fortbildungen?.length > 0 && (
        <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Fortbildungen</Text>
          <View style={styles.tagRow}>
            {t.fortbildungen.map(f => (
              <View key={f} style={[styles.tag, { backgroundColor: c.successBg, borderWidth: 1, borderColor: c.success }]}>
                <Text style={[styles.tagText, { color: c.success }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Details: Kassenart, Zeiten, Website */}
      <View style={[styles.infoSection, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Details</Text>
        {[
          { icon: '💳', label: 'Kassenart', value: t.kassenart.charAt(0).toUpperCase() + t.kassenart.slice(1) },
          { icon: '🕐', label: 'Verfügbar', value: t.verfügbareZeiten },
        ].map(row => (
          <View key={row.label} style={styles.detailInfoRow}>
            <Text style={styles.detailIcon}>{row.icon}</Text>
            <View>
              <Text style={[styles.detailInfoLabel, { color: c.muted }]}>{row.label}</Text>
              <Text style={[styles.detailInfoValue, { color: c.text }]}>{row.value}</Text>
            </View>
          </View>
        ))}
        {t.website ? (
          <Pressable style={styles.detailInfoRow} onPress={() => Linking.openURL(`https://${t.website}`)}>
            <Text style={styles.detailIcon}>🌐</Text>
            <View>
              <Text style={[styles.detailInfoLabel, { color: c.muted }]}>Website</Text>
              <Text style={[styles.detailInfoValue, { color: c.primary }]}>{t.website}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* Praxis */}
      {t.practices?.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.text }]}>Praxis</Text>
          {t.practices.map(p => (
            <Pressable
              key={p.id}
              onPress={() => { setSelectedTherapist(null); setSelectedPractice(p); }}
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
          const phone = t.practices?.[0]?.phone;
          if (phone) Linking.openURL(`tel:${phone}`);
        }}
      >
        <Text style={styles.ctaBtnText}>📞 Praxis anrufen</Text>
      </Pressable>
    </ScrollView>
  );

  // ── Therapist tab ─────────────────────────────────────────────────────────

  const renderTherapist = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Für Therapeuten</Text>
          <Text style={[styles.headerSub, { color: c.muted }]}>Dein Profil auf Revio</Text>
        </View>
      </View>

      <View style={[styles.noticeBox, { backgroundColor: c.successBg, borderColor: c.success }]}>
        <Text style={styles.noticeIcon}>⚕️</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.noticeTitle, { color: c.text }]}>Nur für Physiotherapeuten</Text>
          <Text style={[styles.noticeBody, { color: c.muted }]}>
            Revio ist ausschließlich für zugelassene Physiotherapeuten. Dein Profil wird vor der Veröffentlichung manuell geprüft.
          </Text>
        </View>
      </View>

      <View style={[styles.infoCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.infoTitle, { color: c.text }]}>Werde auf Revio sichtbar</Text>
        <Text style={[styles.infoBody, { color: c.muted }]}>
          Erstelle dein geprüftes Therapeuten-Profil und lass Patienten in Köln dich gezielt nach
          deinen Spezialisierungen finden.
        </Text>
      </View>

      {[
        { num: '1', title: 'Registrieren', body: 'Konto mit E-Mail anlegen' },
        { num: '2', title: 'Profil ausfüllen', body: 'Spezialisierungen, Ausbildung, Sprachen, Praxis' },
        { num: '3', title: 'Zur Prüfung einreichen', body: 'Manuell geprüft — in der Regel innerhalb von 48 h' },
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

      <Pressable>
        <Text style={[styles.loginLink, { color: c.primary }]}>Bereits registriert? Anmelden</Text>
      </Pressable>
    </ScrollView>
  );

  // ── Optionen tab ──────────────────────────────────────────────────────────

  const renderOptions = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Optionen</Text>
          <Text style={[styles.headerSub, { color: c.muted }]}>Einstellungen & Informationen</Text>
        </View>
      </View>

      {[
        { label: 'Sprache', value: 'Deutsch' },
        { label: 'Datenschutz', value: '' },
        { label: 'Impressum', value: '' },
        { label: 'App-Version', value: '0.1.0 MVP' }
      ].map((item) => (
        <Pressable key={item.label} style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.optionLabel, { color: c.text }]}>{item.label}</Text>
          <Text style={[styles.optionValue, { color: c.muted }]}>{item.value} ›</Text>
        </Pressable>
      ))}

      {/* Erscheinungsbild toggle */}
      <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.optionLabel, { color: c.text }]}>Erscheinungsbild</Text>
        <View style={styles.themeToggleRow}>
          {[
            { key: 'light', label: 'Hell' },
            { key: 'dark',  label: 'Dunkel' }
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
    </ScrollView>
  );

  // ── Favorites tab ─────────────────────────────────────────────────────────

  const renderFavorites = () => (
    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={[styles.logoMark, { backgroundColor: c.primary }]}>
          <Text style={styles.logoText}>R</Text>
        </View>
        <Text style={[styles.headerTitle, { color: c.text }]}>Favoriten</Text>
      </View>

      <View style={[styles.noticeBox, { backgroundColor: c.mutedBg, borderColor: c.border, marginBottom: 4 }]}>
        <Text style={styles.noticeIcon}>🔒</Text>
        <Text style={[styles.noticeBody, { color: c.muted }]}>
          Lokal gespeichert · nicht synchronisiert · nur für dich sichtbar
        </Text>
      </View>

      {favorites.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Noch keine Favoriten</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>
            Tippe auf das Herz-Symbol bei einem Therapeuten, um ihn hier zu speichern.
          </Text>
        </View>
      ) : (
        favorites.map((t) => (
          <View key={t.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.cardTop}>
              <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }} onPress={() => setSelectedTherapist(t)}>
                <Image source={{ uri: t.photo }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: c.text }]}>{t.fullName}</Text>
                  <Text style={[styles.cardTitle, { color: c.muted }]}>{t.professionalTitle}</Text>
                </View>
                <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
              </Pressable>
              <Pressable onPress={() => toggleFavorite(t)} hitSlop={10}>
                <Text style={{ fontSize: 22, color: '#E05A77' }}>♥</Text>
              </Pressable>
            </View>
            {t.practices?.length > 0 && (
              <Pressable
                onPress={() => setSelectedPractice(t.practices[0])}
                style={[styles.practiceBtn, { borderColor: c.border, backgroundColor: c.mutedBg }]}
              >
                <View style={[styles.practiceInitial, { backgroundColor: c.border }]}>
                  <Text style={[styles.practiceInitialText, { color: c.muted }]}>{t.practices[0].name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.practiceName, { color: c.text }]}>{t.practices[0].name}</Text>
                  <Text style={[styles.practiceCity, { color: c.muted }]}>{t.practices[0].city}</Text>
                </View>
                <Text style={[styles.practiceArrow, { color: c.muted }]}>›</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.ctaBtn, { backgroundColor: c.accent }]}
              onPress={() => {
                const phone = t.practices?.[0]?.phone;
                if (phone) Linking.openURL(`tel:${phone}`);
              }}
            >
              <Text style={styles.ctaBtnText}>📞 Therapeut kontaktieren</Text>
            </Pressable>
          </View>
        ))
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
              Dein Profil wird innerhalb von 48 Stunden manuell geprüft. Du erhältst eine E-Mail, sobald dein Profil freigeschaltet ist.
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
      if (regStep === 1) return regEmail.length > 3 && regPassword.length >= 6 && regPassword === regPasswordConfirm;
      return true;
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
              <Text style={[styles.regStepTitle, { color: c.text }]}>E-Mail bestätigen</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Wir haben eine Bestätigungs-E-Mail gesendet.</Text>
              <View style={[styles.noticeBox, { backgroundColor: c.successBg, borderColor: c.success }]}>
                <Text style={styles.noticeIcon}>📧</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noticeTitle, { color: c.text }]}>E-Mail prüfen</Text>
                  <Text style={[styles.noticeBody, { color: c.muted }]}>
                    Wir haben einen Link an {regEmail} geschickt. Klicke darauf, dann kannst du hier weitermachen.
                  </Text>
                </View>
              </View>
            </>
          );
        case 3:
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
        case 4:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Fachliches Profil</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>Spezialisierungen, Sprachen & mehr</Text>
              <Text style={[styles.filterSectionTitle, { color: c.muted }]}>Spezialisierungen</Text>
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
              </View>
              <Text style={[styles.filterSectionTitle, { color: c.muted, marginTop: 14 }]}>Fortbildungen</Text>
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
        case 5:
          return (
            <>
              <Text style={[styles.regStepTitle, { color: c.text }]}>Praxis verbinden</Text>
              <Text style={[styles.regStepSub, { color: c.muted }]}>In welcher Praxis arbeitest du?</Text>
              <TextInput value={regPracticeName} onChangeText={setRegPracticeName} placeholder="Praxisname" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regPracticeAddress} onChangeText={setRegPracticeAddress} placeholder="Straße und Hausnummer" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regPracticeCity} onChangeText={setRegPracticeCity} placeholder="Stadt (z. B. Köln)" placeholderTextColor={c.muted} style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
              <TextInput value={regPracticePhone} onChangeText={setRegPracticePhone} placeholder="Telefonnummer" placeholderTextColor={c.muted} keyboardType="phone-pad" style={[styles.regInput, { backgroundColor: c.card, borderColor: c.border, color: c.text }]} />
            </>
          );
        case 6:
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
                { label: 'Praxis', value: regPracticeName || '—' },
                { label: 'Adresse', value: [regPracticeAddress, regPracticeCity].filter(Boolean).join(', ') || '—' },
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
                  Dein Profil wird nach dem Einreichen manuell geprüft. Du wirst per E-Mail benachrichtigt.
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
          <Text style={[styles.backBtnText, { color: c.primary }]}>‹ {regStep === 1 ? 'Abbrechen' : 'Zurück'}</Text>
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
                    fullName: `${regFirstName} ${regLastName}`.trim(),
                    professionalTitle: 'Physiotherapeut/in',
                    city: regCity,
                    bio: regBio || undefined,
                    homeVisit: regHomeVisit,
                    specializations: regSpecializations,
                    languages: regLanguages.map(l => l.toLowerCase()),
                    certifications: regFortbildungen,
                    practice: {
                      name: regPracticeName,
                      city: regPracticeCity,
                      address: regPracticeAddress || undefined,
                      phone: regPracticePhone || undefined,
                    },
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

  // ── Layout ────────────────────────────────────────────────────────────────

  const renderTab = () => {
    if (showRegister) return renderRegister();
    if (selectedTherapist) return renderTherapistProfile(selectedTherapist);
    if (selectedPractice) return renderPracticeProfile(selectedPractice);
    if (activeTab === 'favorites') return renderFavorites();
    if (activeTab === 'therapist') return renderTherapist();
    if (activeTab === 'options') return renderOptions();
    return renderDiscover();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />

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
                if (tab.key === 'discover') {
                  setQuery('');
                  setActiveChip(null);
                  setResults([]);
                  setSearched(false);
                  setShowAutocomplete(false);
                  setShowFilters(false);
                  setCity('Köln');
                  setUserCoords(null);
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
                {tab.label}
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
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 1 },

  // Search box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10
  },
  searchIcon: { fontSize: 18 },
  searchInput: { flex: 1, fontSize: 16 },
  clearIcon: { fontSize: 14 },

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
  practiceLogoText: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
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
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderRadius: 16, padding: 14
  },
  noticeIcon: { fontSize: 22, marginTop: 1 },
  noticeTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  noticeBody: { fontSize: 13, lineHeight: 18 },
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
