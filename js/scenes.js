// Catálogo de cenas do simulador. Para adicionar um cenário novo:
//  1) crie o arquivo js/scenario-<nome>.js exportando uma função async (g, run, opts)
//  2) importe aqui, preencha `run` e `phases` e marque `available: true`
//  3) inclua o arquivo novo na lista ARQUIVOS do sw.js
import { runIncendio, FASES_INCENDIO } from './scenario-incendio.js';
import { runExtintor, FASES_EXTINTOR } from './scenario-extintor.js';

export const SCENES = [
  {
    id: 'incendio',
    title: 'Incêndio residencial',
    desc: 'Prevenção, fogo na panela, fuga com fumaça e como pedir socorro.',
    duration: '5 a 8 min',
    icon: 'fire',
    color: '#f97316',
    available: true,
    phases: FASES_INCENDIO,
    run: runIncendio,
    env: 'house',
  },
  {
    id: 'deslizamento',
    title: 'Deslizamento de encosta',
    desc: 'Sinais de alerta em áreas de risco e evacuação segura.',
    icon: 'landslide',
    color: '#a16207',
    available: false,
  },
  {
    id: 'enchente',
    title: 'Enchente e alagamento',
    desc: 'O que fazer antes, durante e depois de uma enchente.',
    icon: 'flood',
    color: '#0284c7',
    available: false,
  },
  {
    id: 'quimico',
    title: 'Vazamento químico',
    desc: 'Abrigar-se no local ou evacuar? Aprenda a decidir.',
    icon: 'chemical',
    color: '#65a30d',
    available: false,
  },
  {
    id: 'extintor',
    title: 'Uso do extintor',
    desc: 'Inspeção, classes de incêndio, técnica correta e quando não combater.',
    duration: '6 a 9 min',
    icon: 'extinguisher',
    color: '#dc2626',
    available: true,
    phases: FASES_EXTINTOR,
    run: runExtintor,
    env: 'yard',
  },
];

export const sceneById = (id) => SCENES.find((s) => s.id === id);
