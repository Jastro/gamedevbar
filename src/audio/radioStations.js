// Stations the bar radios can play. Live streams are the same broadcast for
// everyone; Taberna FM is a local loop kept in sync with the server clock.
// Every URL must send CORS headers: the audio goes through Web Audio
// (positional + wall muffling), and without CORS the browser feeds silence.
// Checked 2026-10-20 (curl with an Origin header).
export const RADIO_STATIONS = [
    { id: 'taberna-fm', name: 'Taberna FM', genre: 'La de siempre', url: 'assets/sound/ElFary_LaMandanga.mp3', loop: true },
    { id: 'los40', name: 'LOS40', genre: 'Éxitos', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40.mp3' },
    { id: 'los40-classic', name: 'LOS40 Classic', genre: 'Éxitos de siempre', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40_CLASSIC.mp3' },
    { id: 'los40-urban', name: 'LOS40 Urban', genre: 'Urbano', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40_URBAN.mp3' },
    { id: 'cadena-dial', name: 'Cadena Dial', genre: 'Música en español', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENADIAL.mp3' },
    { id: 'cadena-100', name: 'Cadena 100', genre: 'Pop', url: 'https://cadena100-streamers-mp3.flumotion.com/cope/cadena100.mp3' },
    { id: 'rock-fm', name: 'Rock FM', genre: 'Rock', url: 'https://rockfm-cope-rrcast.flumotion.com/cope/rockfm.mp3' },
    { id: 'kiss-fm', name: 'Kiss FM', genre: 'Pop 80s-2000s', url: 'https://kissfm.kissfmradio.cires21.com/kissfm.mp3' },
    { id: 'hit-fm', name: 'Hit FM', genre: 'Dance y pop', url: 'https://hitfm.kissfmradio.cires21.com/hitfm.mp3' },
    { id: 'megastar', name: 'MegaStar FM', genre: 'Dance', url: 'https://megastar-cope-rrcast.flumotion.com/cope/megastar.mp3' },
    { id: 'm80', name: 'M80 Radio', genre: 'Clásicos 80s-90s', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/M80RADIO.mp3' },
    { id: 'radiole', name: 'Radiolé', genre: 'Flamenco y copla', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/RADIOLE.mp3' },
    { id: 'cadena-ser', name: 'Cadena SER', genre: 'Noticias y deportes', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3' },
    { id: 'cope', name: 'COPE', genre: 'Noticias y deportes', url: 'https://flucast31-h-cloud.flumotion.com/cope/net1.mp3' }
];

export function getStation(stationId) {
    return RADIO_STATIONS.find(station => station.id === stationId) ?? null;
}
