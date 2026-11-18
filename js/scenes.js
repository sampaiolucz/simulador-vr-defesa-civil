// Catálogo de cenas do simulador. Para adicionar um cenário novo:
//  1) crie o arquivo js/scenario-<nome>.js exportando uma função async (g, run, opts)
//  2) importe aqui, preencha `run` e `phases` e marque `available: true`
//  3) inclua o arquivo novo na lista ARQUIVOS do sw.js
import { runIncendio, FASES_INCENDIO } from './scenario-incendio.js';
import { runExtintor, FASES_EXTINTOR } from './scenario-extintor.js';
import { runDeslizamento, FASES_DESLIZAMENTO } from './scenario-deslizamento.js';
import { runEnchente, FASES_ENCHENTE } from './scenario-enchente.js';
import { runQuimico, FASES_QUIMICO } from './scenario-quimico.js';

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
    desc: 'Fatores de risco, sinais de alerta, a hora de sair e o que fazer depois.',
    duration: '7 a 10 min',
    icon: 'landslide',
    color: '#a16207',
    available: true,
    phases: FASES_DESLIZAMENTO,
    run: runDeslizamento,
    env: 'hill',
  },
  {
    id: 'enchente',
    title: 'Enchente e alagamento',
    desc: 'Preparar a casa, agir quando a água sobe, sair com segurança e cuidados depois.',
    duration: '7 a 10 min',
    icon: 'flood',
    color: '#0284c7',
    available: true,
    phases: FASES_ENCHENTE,
    run: runEnchente,
    env: 'house',
  },
  {
    id: 'quimico',
    title: 'Vazamento químico',
    desc: 'Identificar o produto, afastar-se, abrigar-se em casa e evacuar com segurança.',
    duration: '7 a 10 min',
    icon: 'chemical',
    color: '#65a30d',
    available: true,
    phases: FASES_QUIMICO,
    run: runQuimico,
    env: 'house',
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
