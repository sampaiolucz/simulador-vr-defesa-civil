// Cenário 2 — Uso do extintor (campo de treinamento)
// Fases: 1) Inspeção  2) Classes de incêndio  3) Técnica de uso (prática)  4) Quando NÃO combater → Resultado
//
// IMPORTANTE: os textos educativos estão concentrados neste arquivo e devem ser revisados pela
// equipe da Defesa Civil / Corpo de Bombeiros antes do uso público.
import * as THREE from 'three';
import { makeWaypoint } from './world.js';
import { makeExtinguisher, EXT_TYPES } from './training-yard.js';
import { Aborted, clamp, yawTo } from './util.js';
import { createScore, showResults } from './results.js';

export const FASES_EXTINTOR = ['Inspeção', 'Classes de incêndio', 'Técnica de uso', 'Quando não combater'];

const CORES_JATO = {
  agua: [0.62, 0.8, 1.0],
  co2: [0.97, 0.98, 1.0],
  po_bc: [0.96, 0.95, 0.9],
  po_abc: [0.96, 0.95, 0.9],
};

export async function runExtintor(g, run, opts = {}) {
  const { ui, sfx, fx, yard } = g;
  const O = yard.o;
  const W = (x, y, z) => yard.w(x, y, z);
  const { results, record } = createScore();

  const on = (obj, label, fn) => {
    const rm = g.interact.add(obj, {
      label,
      onSelect: () =>
        Promise.resolve()
          .then(fn)
          .catch((e) => {
            if (!(e instanceof Aborted)) console.error(e);
          }),
    });
    run.onCleanup(rm);
    return rm;
  };

  /** Teleporta para uma posição local do campo, olhando para um ponto local. */
  const goTo = (x, z, lookX, lookZ) => {
    const p = W(x, 0, z);
    return g.teleport(p.x, p.z, yawTo(lookX - x, lookZ - z));
  };
  const poseAt = (x, z, lookX, lookZ) => {
    const p = W(x, 0, z);
    g.player.setPose(p.x, p.z, yawTo(lookX - x, lookZ - z));
  };

  // ------------------------------------------------------------------ Abertura
  g.world.setNight(false);
  poseAt(0, 6.5, 0, 0);
  await g.fade(0, 0.5);
  await ui.ask(run, {
    title: 'Uso do Extintor',
    body:
      'Defesa Civil de Cubatão — Campo de treinamento\n\n' +
      'Você vai aprender a inspecionar um extintor, escolher o tipo certo para cada classe de incêndio, usá-lo corretamente e reconhecer quando NÃO se deve combater o fogo.\n\n' +
      (g.isXR
        ? 'COMO INTERAGIR: aponte e faça a pinça para selecionar. Para disparar o extintor, mantenha a pinça (ou o gatilho) apertada.'
        : 'NO COMPUTADOR: clique para selecionar. Para disparar o extintor, segure o botão do mouse ou a barra de espaço.'),
    buttons: [{ label: 'Começar' }],
    width: 1.25,
  });

  // ------------------------------------------------------------------ FASE 1 — Inspeção
  const fase1 = async () => {
    const fase = 'Inspeção';
    await goTo(-9, 2.2, -9, 0);
    await ui.ask(run, {
      title: 'Fase 1 — Inspeção',
      body:
        'Antes de usar um extintor, é preciso saber se ele vai funcionar.\n\n' +
        'Neste abrigo há três extintores de pó químico ABC. Selecione cada um para inspecionar e escolha o que você usaria.',
      buttons: [{ label: 'Inspecionar' }],
    });
    ui.setHud(['FASE 1 — INSPEÇÃO', 'Escolha o extintor em condições de uso']);

    const y = new Date().getFullYear();
    const fichas = [
      ['Manômetro: ponteiro na faixa VERMELHA, à esquerda', 'Lacre e pino: intactos', `Etiqueta de manutenção: válida até 08/${y + 1}`, 'Mangueira e bico: sem rachaduras'],
      ['Manômetro: ponteiro na faixa verde', 'Lacre: ROMPIDO, pino solto', `Etiqueta de manutenção: VENCIDA em 03/${y - 1}`, 'Mangueira e bico: sem rachaduras'],
      ['Manômetro: ponteiro na faixa verde', 'Lacre e pino: intactos', `Etiqueta de manutenção: válida até 08/${y + 1}`, 'Mangueira e bico: sem rachaduras'],
    ];
    const erroMsg = [
      {
        title: 'Este extintor está descarregado',
        body: 'O ponteiro na faixa vermelha da esquerda indica que o extintor está sem pressão: ele não vai funcionar. (Na faixa vermelha da direita, estaria com pressão acima do normal.)\n\nAvise o responsável e escolha outro.',
      },
      {
        title: 'Este extintor não está em condições',
        body: 'Lacre rompido indica que ele pode ter sido usado ou violado, e a manutenção está vencida. Ele pode falhar justamente na emergência.\n\nAvise o responsável e escolha outro.',
      },
    ];
    let first = null;
    const done = run.deferred();
    O.inspect.forEach((ext, i) => {
      on(ext, `Extintor ${i + 1}`, async () => {
        if (done.done) return;
        const c = await ui.ask(run, {
          title: `Extintor ${i + 1} — inspeção`,
          body: 'O que você observa:\n\n' + fichas[i].map((f) => '• ' + f).join('\n'),
          buttons: [
            { label: 'Usar este extintor', value: 'usar' },
            { label: 'Ver outro', value: 'outro' },
          ],
          sound: false,
        });
        if (c !== 'usar') return;
        if (first === null) first = i;
        if (i === 2) done.resolve();
        else await ui.ask(run, { tone: 'danger', ...erroMsg[i], buttons: [{ label: 'Escolher outro' }] });
      });
    });
    await done.promise;
    O.inspect.forEach((e) => g.interact.remove(e));
    record(fase, 'Escolheu o extintor em condições na primeira tentativa', first === 2, 2);
    await ui.ask(run, {
      tone: 'success',
      title: first === 2 ? 'Muito bem!' : 'Agora sim!',
      body:
        'O extintor 3 está pronto para uso. Na inspeção, confira:\n' +
        '• Manômetro na faixa verde\n• Lacre e pino intactos\n• Etiqueta de manutenção dentro da validade\n• Mangueira e bico sem danos\n• Acesso livre e sinalizado\n\n' +
        'Extintores de CO2 não têm manômetro: são verificados pelo peso, na manutenção.',
      buttons: [{ label: 'Próxima fase' }],
    });
    ui.setHud([]);
  };

  // ------------------------------------------------------------------ FASE 2 — Classes de incêndio
  const fase2 = async () => {
    const fase = 'Classes de incêndio';
    await goTo(0, 3.4, 0, 0);
    const fires = {
      A: fx.fire(yard.wv(O.fireSpots.A), { radius: 0.17, size: 0.26, height: 0.75 }),
      B: fx.fire(yard.wv(O.fireSpots.B), { radius: 0.36, size: 0.32, height: 0.9, count: 90, light: true }),
      C: fx.fire(yard.wv(O.fireSpots.C), { radius: 0.12, size: 0.2, height: 0.5 }),
    };
    const sparks = fx.sparks(yard.wv(O.fireSpots.C).add(new THREE.Vector3(0, -0.1, 0.05)));
    Object.values(fires).forEach((f) => f.setIntensity(1, 0.8));
    sparks.setIntensity(1, 0.3);
    sfx.setFire(0.8);

    await ui.ask(run, {
      title: 'Fase 2 — Classes de incêndio',
      body:
        'Cada tipo de material pede o extintor certo:\n' +
        '• Classe A: materiais sólidos (papel, madeira, tecido)\n' +
        '• Classe B: líquidos inflamáveis (gasolina, álcool, solventes)\n' +
        '• Classe C: equipamentos elétricos LIGADOS na energia\n\n' +
        'Selecione cada foco e escolha o extintor. Os quatro tipos estão na bancada à esquerda.',
      buttons: [{ label: 'Vamos lá' }],
    });

    const certo = { A: ['agua', 'po_abc'], B: ['co2', 'po_bc', 'po_abc'], C: ['co2', 'po_bc', 'po_abc'] };
    const nomes = { A: 'Lixeira com papel', B: 'Bandeja com líquido inflamável', C: 'Painel elétrico energizado' };
    const pontos = { A: 1, B: 2, C: 2 };
    const fb = (cls, t) => {
      const nome = EXT_TYPES[t].nome;
      if (cls === 'A') {
        if (t === 'agua') return { ok: true, body: 'A água resfria os materiais sólidos, como papel e madeira, e apaga o fogo por dentro. O pó ABC também serviria.' };
        if (t === 'po_abc') return { ok: true, body: 'O pó ABC abafa o fogo em materiais sólidos. A água pressurizada também é indicada para a classe A.' };
        if (t === 'co2') return { ok: false, body: 'O CO2 abafa por pouco tempo e não resfria o material: em papel e madeira o fogo pode reacender. Para a classe A, use água ou pó ABC.' };
        return { ok: false, body: 'O pó BC não é indicado para a classe A: ele não age dentro dos materiais sólidos e o fogo pode voltar. Use água ou pó ABC.' };
      }
      if (cls === 'B') {
        if (t === 'agua') return { ok: false, body: 'Nunca use água em líquidos inflamáveis! A água espalha o líquido em chamas e o fogo aumenta. Use pó químico (BC ou ABC) ou CO2.' };
        return { ok: true, body: `O extintor de ${nome} abafa o fogo em líquidos inflamáveis. Mire na base das chamas, sem jogar o jato direto no líquido para não espalhá-lo.` };
      }
      if (t === 'agua')
        return {
          ok: false,
          body: 'PERIGO DE CHOQUE ELÉTRICO! A água conduz eletricidade. Em equipamento energizado use CO2 ou pó químico (BC ou ABC).\n\nSe puder, desligue a energia no disjuntor: sem energia, o material passa a ser tratado como classe A.',
        };
      return { ok: true, body: `O extintor de ${nome} não conduz eletricidade. Se puder, desligue a energia no disjuntor antes de combater.` };
    };

    const apagados = new Set();
    const firstTry = {};
    const hud = () => ui.setHud(['FASE 2 — CLASSES DE INCÊNDIO', `Focos apagados: ${apagados.size} de 3`]);
    hud();
    const done = run.deferred();

    const jato = async (cls, tipo) => {
      const head = g.player.headWorld();
      const alvo = yard.wv(O.fireSpots[cls]);
      const origin = head.clone().add(new THREE.Vector3(0, -0.45, 0)).lerp(alvo, 0.15);
      const dir = alvo.clone().sub(origin).normalize();
      const s = fx.spray(CORES_JATO[tipo]);
      s.set(true, origin, dir);
      sfx.setSpray(true);
      await run.wait(1.3);
      s.set(false);
      sfx.setSpray(false);
      await run.wait(0.6);
      fx.remove(s);
    };

    for (const [cls, obj] of [
      ['A', O.bin],
      ['B', O.tray],
      ['C', O.panel],
    ]) {
      on(obj, nomes[cls], async () => {
        if (apagados.has(cls)) return;
        const tipo = await ui.ask(run, {
          title: nomes[cls],
          body: `Incêndio classe ${cls}. Qual extintor você usa?`,
          columns: 2,
          sound: false,
          buttons: [
            { label: 'Água pressurizada', value: 'agua' },
            { label: 'Gás carbônico (CO2)', value: 'co2' },
            { label: 'Pó químico BC', value: 'po_bc' },
            { label: 'Pó químico ABC', value: 'po_abc' },
          ],
        });
        const r = fb(cls, tipo);
        if (firstTry[cls] === undefined) firstTry[cls] = r.ok;
        if (r.ok) {
          await jato(cls, tipo);
          fires[cls].setIntensity(0, 0.8);
          if (cls === 'C') sparks.setIntensity(0, 0.5);
          apagados.add(cls);
          hud();
          await ui.ask(run, { tone: 'success', title: 'Correto!', body: r.body, buttons: [{ label: 'Continuar' }] });
          if (apagados.size === 3) done.resolve();
        } else {
          const jatoP = jato(cls, tipo);
          await run.wait(0.7);
          if (tipo === 'agua' && cls === 'B') {
            fires.B.setIntensity(3.2, 0.25);
            sfx.whoosh(1.1);
          } else if (tipo === 'agua' && cls === 'C') {
            sparks.setIntensity(3, 0.1);
            sfx.zap();
            g.setSmokeOverlay(0.5); // clarão
            await run.wait(0.25);
            g.setSmokeOverlay(0);
          } else {
            fires[cls].setIntensity(0.3, 0.6);
          }
          await jatoP;
          if (tipo !== 'agua') {
            fires[cls].setIntensity(1, 0.8);
            ui.showToast('O fogo voltou!', 'danger', 2.5);
          }
          await ui.ask(run, { tone: 'danger', title: tipo === 'agua' && cls === 'C' ? 'Choque elétrico!' : 'Extintor errado', body: r.body, buttons: [{ label: 'Tentar de novo' }] });
          fires[cls].setIntensity(1, 0.8);
          if (cls === 'C') sparks.setIntensity(1, 0.3);
        }
      });
    }

    await done.promise;
    [O.bin, O.tray, O.panel].forEach((o) => g.interact.remove(o));
    for (const cls of ['A', 'B', 'C']) record(fase, `Classe ${cls}: escolheu o extintor certo de primeira`, !!firstTry[cls], pontos[cls]);
    sfx.setFire(0);
    await ui.ask(run, {
      tone: 'success',
      title: 'Resumo das classes',
      body:
        '• Classe A (sólidos): água ou pó ABC\n' +
        '• Classe B (líquidos inflamáveis): pó BC, pó ABC ou CO2 — NUNCA água\n' +
        '• Classe C (equipamento energizado): CO2, pó BC ou pó ABC — NUNCA água\n\n' +
        'O pó ABC serve para as três classes: por isso é muito usado em casas, carros e condomínios.',
      buttons: [{ label: 'Próxima fase' }],
    });
    fx.clear();
    ui.setHud([]);
  };

  // ------------------------------------------------------------------ FASE 3 — Técnica de uso
  const fase3 = async () => {
    const fase = 'Técnica de uso';
    fx.clear();
    yard.reset();
    await goTo(9, 6, 9, 0);
    const base = yard.wv(O.practiceBase);
    const fire = fx.fire(base, { radius: 0.48, size: 0.34, height: 1.1, count: 110, light: true });
    fire.setIntensity(1.3, 0.8);
    fx.smoke(base.clone().add(new THREE.Vector3(0, 1.1, 0)), { count: 45, size: 0.9, height: 0.8, radius: 0.3, drift: new THREE.Vector3(0, 0.9, -3.8) }).setIntensity(1, 0.5);
    sfx.setFire(1);

    await ui.ask(run, {
      title: 'Fase 3 — Técnica de uso',
      body:
        'Agora é na prática! Siga os passos:\n' +
        '1. Pegue o extintor de pó ABC no suporte.\n' +
        '2. Escolha onde se posicionar (a biruta laranja mostra para onde o vento sopra).\n' +
        '3. Prepare o extintor.\n' +
        '4. Combata o fogo.',
      buttons: [{ label: 'Começar' }],
    });

    // Passo 1: pegar o extintor
    ui.setHud(['FASE 3 — TÉCNICA', 'Pegue o extintor no suporte']);
    const pegou = run.deferred();
    on(O.practiceExt, 'Extintor de pó ABC', () => {
      O.practiceExt.visible = false;
      g.interact.remove(O.practiceExt);
      sfx.good();
      pegou.resolve();
    });
    await pegou.promise;

    // extintor “na mão”
    const held = makeExtinguisher('po_abc');
    g.scene.add(held);
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 1, 8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.07, 10), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    g.scene.add(hose, nozzle);
    run.onCleanup(() => g.scene.remove(held, hose, nozzle));
    const up = new THREE.Vector3(0, 1, 0);
    const tmp = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const nozzlePose = { origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1) };
    const aimInfo = { aim: null };
    run.onFrame(() => {
      const aim = g.getAim();
      aimInfo.aim = aim;
      const head = g.player.headWorld();
      g.camera.getWorldDirection(camDir);
      const fwd = camDir.clone().setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
      if (aim && aim.xr) {
        nozzlePose.origin.copy(aim.origin).addScaledVector(aim.dir, 0.1);
        nozzlePose.dir.copy(aim.dir);
        held.position.copy(aim.origin).add(new THREE.Vector3(0, -0.62, 0)).addScaledVector(fwd, 0.08);
      } else {
        held.position.copy(head).addScaledVector(right, 0.32).addScaledVector(fwd, 0.62).add(new THREE.Vector3(0, -0.85, 0));
        nozzlePose.origin.copy(head).addScaledVector(right, 0.17).addScaledVector(fwd, 0.5).add(new THREE.Vector3(0, -0.22, 0));
        if (aim) {
          // mira pelo cursor do mouse: o jato vai do bico até o ponto que o cursor indica na distância do fogo
          const d = Math.max(1, aim.origin.distanceTo(base));
          tmp.copy(aim.origin).addScaledVector(aim.dir, d);
          nozzlePose.dir.copy(tmp).sub(nozzlePose.origin).normalize();
        }
      }
      held.rotation.set(0, Math.atan2(fwd.x, fwd.z), 0);
      // mangueira: do topo do extintor até o bico
      const topP = held.localToWorld(new THREE.Vector3(0.04, held.userData.top, 0));
      const seg = new THREE.Vector3().subVectors(nozzlePose.origin, topP);
      hose.position.copy(topP).addScaledVector(seg, 0.5);
      hose.scale.set(1, Math.max(0.01, seg.length()), 1);
      hose.quaternion.setFromUnitVectors(up, seg.clone().normalize());
      nozzle.position.copy(nozzlePose.origin);
      nozzle.quaternion.setFromUnitVectors(up, nozzlePose.dir);
    });

    // Passo 2: posição
    ui.setHud(['FASE 3 — TÉCNICA', 'Escolha onde se posicionar (observe a biruta)']);
    let firstPos = null;
    let posOk = false;
    while (!posOk) {
      const escolha = run.deferred();
      const wps = [];
      for (const [nome, p] of Object.entries(O.spots)) {
        const wp = makeWaypoint(W(p.x, 0, p.z).x, W(p.x, 0, p.z).z);
        g.scene.add(wp);
        const unhook = run.onFrame((dt, t) => wp.userData.animate(t));
        const rm = g.interact.add(wp, { label: 'Posicionar-se aqui', onSelect: () => escolha.resolve(nome) });
        const remove = () => {
          rm();
          unhook();
          g.scene.remove(wp);
        };
        run.onCleanup(remove);
        wps.push(remove);
      }
      const nome = await escolha.promise;
      wps.forEach((r) => r());
      if (firstPos === null) firstPos = nome;
      const p = O.spots[nome];
      await goTo(p.x, p.z, O.practiceBase.x, O.practiceBase.z);
      if (nome === 'certo') {
        posOk = true;
        ui.showToast(['Boa posição!', '2 a 3 m do fogo, com o vento pelas costas.'], 'success', 3.5);
        sfx.good();
      } else if (nome === 'contraVento') {
        g.setSmokeOverlay(0.65);
        sfx.cough();
        await run.wait(1.2);
        await ui.ask(run, {
          tone: 'danger',
          title: 'Vento contra você!',
          body: 'Daqui, o vento sopra a fumaça, o calor e o próprio pó do extintor no seu rosto. Observe a biruta: ela aponta para onde o vento vai. Fique com o vento pelas costas.',
          buttons: [{ label: 'Escolher outra posição' }],
        });
        g.setSmokeOverlay(0);
        await goTo(9, 6, 9, 0);
      } else {
        await ui.ask(run, {
          tone: 'warning',
          title: 'Perto demais!',
          body: 'A cerca de 1 metro o calor pode causar queimaduras, e o jato forte pode espalhar o líquido em chamas. Comece a uns 2 ou 3 metros do fogo e avance aos poucos, se precisar.',
          buttons: [{ label: 'Escolher outra posição' }],
        });
        await goTo(9, 6, 9, 0);
      }
    }

    // Passo 3: preparar
    const prep = await ui.ask(run, {
      title: 'Preparar o extintor',
      body: 'Você está em posição. Qual é o primeiro passo antes de apertar o gatilho?',
      columns: 1,
      buttons: [
        { label: 'Apertar o gatilho para testar', value: 'gatilho' },
        { label: 'Retirar o pino de segurança, rompendo o lacre', value: 'pino' },
        { label: 'Virar o extintor de cabeça para baixo', value: 'virar' },
      ],
    });
    if (prep !== 'pino') {
      await ui.ask(run, {
        tone: 'warning',
        title: 'Primeiro, retire o pino',
        body: 'Com o pino de segurança, o gatilho fica travado e o extintor não dispara. Segure o extintor em pé (não o vire) e puxe o pino, rompendo o lacre.',
        buttons: [{ label: 'Retirar o pino' }],
      });
    }
    held.userData.pin.visible = false;
    sfx.click();

    // Passo 4: combate
    await ui.ask(run, {
      title: 'Hora de apagar!',
      body: g.isXR
        ? 'Aponte para a BASE das chamas e mantenha a pinça (ou o gatilho) apertada para disparar.\n\nMova a mão de um lado para o outro, em leque, cobrindo toda a área do fogo. A carga dura poucos segundos!'
        : 'Aponte o mouse para a BASE das chamas e segure o botão do mouse (ou a barra de espaço) para disparar.\n\nMova o mouse de um lado para o outro, em leque. A carga dura poucos segundos!',
      buttons: [{ label: 'Estou pronto' }],
    });
    g.aimMode = true;
    const spray = fx.spray(CORES_JATO.po_abc);
    const CHARGE_TIME = 14; // segundos de jato
    const st = { health: 1, charge: 1, spray: 0, base: 0, sweep: 0 };
    const lats = []; // histórico do desvio lateral da mira (para detectar varredura)
    let tipT = 0;
    let shown = '';
    const done = run.deferred();
    const hud = () => {
      const pc = Math.max(0, Math.round(st.charge * 100));
      const blocks = Math.round(st.charge * 10);
      const line = `Carga: ${'■'.repeat(blocks)}${'□'.repeat(10 - blocks)} ${pc}%`;
      if (line === shown) return;
      shown = line;
      ui.setHud(['COMBATA O FOGO', 'Mire na BASE e faça varredura', line], 'danger');
    };
    hud();
    const P = new THREE.Vector3();
    run.onFrame((dt, t) => {
      if (done.done) return;
      const aim = aimInfo.aim;
      const pressed = !!(aim && aim.pressed) && st.charge > 0 && !ui.modalOpen;
      spray.set(pressed, nozzlePose.origin, nozzlePose.dir);
      sfx.setSpray(pressed);
      tipT -= dt;
      if (st.health <= 0) return done.resolve('ok');
      if (st.charge <= 0) return done.resolve('vazio');
      if (!pressed) return;
      st.charge = Math.max(0, st.charge - dt / CHARGE_TIME);
      st.spray += dt;
      hud();
      // onde o jato cruza o “plano” do fogo
      const o = nozzlePose.origin;
      const d = nozzlePose.dir;
      const hx = base.x - o.x;
      const hz = base.z - o.z;
      const dist = Math.hypot(hx, hz);
      const hLen = Math.hypot(d.x, d.z);
      let lateral = 9;
      let height = 9;
      if (hLen > 0.05 && d.x * hx + d.z * hz > 0) {
        P.copy(o).addScaledVector(d, dist / hLen);
        // desvio lateral (perpendicular à linha jogador→fogo)
        lateral = ((P.x - base.x) * -hz + (P.z - base.z) * hx) / dist;
        height = P.y - base.y;
      }
      const inReach = dist <= 4.3;
      const onTarget = inReach && Math.abs(lateral) < 0.8 && height > -0.5 && height < 1.5;
      const atBase = inReach && Math.abs(lateral) < 0.7 && height > -0.4 && height < 0.4;
      if (onTarget) {
        lats.push([t, lateral]);
        while (lats.length && t - lats[0][0] > 1.2) lats.shift();
      }
      const ls = lats.map((l) => l[1]);
      const sweeping = ls.length > 4 && Math.max(...ls) - Math.min(...ls) > 0.35;
      if (atBase) {
        st.base += dt;
        if (sweeping) st.sweep += dt;
      }
      const eff = (atBase ? (sweeping ? 1 : 0.55) : onTarget ? 0.12 : 0) * (dist < 1.3 ? 0.6 : 1);
      st.health = Math.max(0, st.health - (dt * eff) / 5.5);
      fire.setIntensity(st.health > 0 ? 0.2 + st.health * 1.1 : 0, 0.15);
      if (st.health <= 0 || st.charge <= 0) return; // o próximo quadro encerra a fase
      if (tipT <= 0) {
        if (!inReach) ui.showToast('Longe demais: o jato não alcança. Aproxime-se um pouco.', 'warning', 2.2);
        else if (onTarget && !atBase) ui.showToast('Mire mais baixo: na BASE das chamas!', 'warning', 2.2);
        else if (!onTarget) ui.showToast('Aponte para o fogo!', 'warning', 2.2);
        else if (!sweeping) ui.showToast('Faça varredura: de um lado para o outro, em leque.', 'info', 2.2);
        else {
          tipT = 0;
          return;
        }
        tipT = 2.6;
      }
    });
    const outcome = await done.promise;
    g.aimMode = false;
    spray.set(false);
    sfx.setSpray(false);
    if (outcome === 'ok') {
      fire.setIntensity(0, 0.8);
      sfx.setFire(0);
      sfx.good();
    }
    await run.wait(1.2);
    const baseRatio = st.spray > 0 ? st.base / st.spray : 0;
    const sweepRatio = st.base > 0 ? st.sweep / st.base : 0;
    record(fase, 'Posicionou-se a 2–3 m com o vento pelas costas', firstPos === 'certo', 2);
    record(fase, 'Sabia que o primeiro passo é retirar o pino', prep === 'pino', 1);
    const bp = baseRatio >= 0.6 ? 2 : baseRatio >= 0.35 ? 1 : 0;
    record(fase, `Mirou na base das chamas (${Math.round(baseRatio * 100)}% do jato)`, bp === 2, 2, bp);
    record(fase, 'Fez movimentos de varredura', sweepRatio >= 0.4, 1);
    record(fase, 'Apagou o fogo antes de a carga acabar', outcome === 'ok', 2);
    await ui.ask(run, {
      tone: outcome === 'ok' ? 'success' : 'warning',
      title: outcome === 'ok' ? 'Fogo apagado!' : 'A carga acabou!',
      body:
        outcome === 'ok'
          ? `Você usou ${Math.round((1 - st.charge) * 100)}% da carga.\n\nContinue atento: o fogo pode reacender. Afaste-se sem dar as costas para o local. Depois de usado, mesmo que só um pouco, o extintor deve ir para recarga.`
          : 'Um extintor portátil de pó dura poucos segundos (cerca de 10 a 15). Por isso é preciso mirar na base e fazer a varredura desde o início. Se o fogo não apagar, afaste-se e ligue 193.',
      buttons: [{ label: 'Próxima fase' }],
    });
    g.scene.remove(held, hose, nozzle);
    fx.clear();
    sfx.setFire(0);
    ui.setHud([]);
  };

  // ------------------------------------------------------------------ FASE 4 — Quando NÃO combater
  const fase4 = async () => {
    const fase = 'Quando não combater';
    fx.clear();
    await goTo(0, -3.4, 0, -9);
    O.containerFires.forEach((p, i) => fx.fire(yard.wv(p), { radius: 0.4, size: 0.42, height: i === 3 ? 0.6 : 1.5, count: 100, light: i === 2 }).setIntensity(1.7, 0.6));
    fx.smoke(W(0, 2.3, -7.6), { count: 50, size: 1.2, height: 3.5, radius: 0.6, drift: new THREE.Vector3(0, 1.5, 1.2) }).setIntensity(1, 0.5);
    fx.smoke(W(-1.5, 2.7, -9), { count: 40, size: 1.3, height: 4, radius: 1 }).setIntensity(1, 0.5);
    sfx.setFire(1.6);
    ui.setHud(['FASE 4 — QUANDO NÃO COMBATER', 'Observe o depósito...']);
    await run.wait(3.5); // deixa a pessoa ver o tamanho do fogo antes da pergunta

    const q1 = await ui.ask(run, {
      tone: 'danger',
      title: 'Fase 4 — Quando NÃO combater',
      body: 'O fogo neste depósito já atinge o teto e a fumaça está densa e escura. Você tem um extintor de pó ABC nas mãos.\n\nO que você faz?',
      columns: 1,
      buttons: [
        { label: 'Entro com o extintor e tento apagar', value: 'combater' },
        { label: 'Saio de perto, afasto as pessoas e ligo 193', value: 'sair' },
      ],
    });
    record(fase, 'Não enfrentou um incêndio grande e ligou 193', q1 === 'sair', 2);
    await ui.ask(run, {
      tone: q1 === 'sair' ? 'success' : 'danger',
      title: q1 === 'sair' ? 'Decisão correta!' : 'Não arrisque a sua vida!',
      body:
        'O extintor portátil serve para PRINCÍPIOS de incêndio, quando o fogo ainda é pequeno.\n\n' +
        'Se as chamas já atingem o teto, a fumaça está densa ou o fogo cresce rápido: não combata. Saia, feche a porta se for seguro, afaste as pessoas e ligue 193.',
      buttons: [{ label: 'Continuar' }],
    });

    const q2 = await ui.ask(run, {
      title: 'Combate em local fechado',
      body: 'Em um princípio de incêndio dentro de um cômodo, onde deve ficar a saída enquanto você usa o extintor?',
      columns: 1,
      buttons: [
        { label: 'Do outro lado do fogo', value: 'outro' },
        { label: 'Às minhas costas, livre', value: 'costas' },
        { label: 'Tanto faz', value: 'tanto' },
      ],
    });
    record(fase, 'Manter a saída livre às costas', q2 === 'costas');
    await ui.ask(run, {
      tone: q2 === 'costas' ? 'success' : 'warning',
      title: q2 === 'costas' ? 'Isso mesmo!' : 'A saída deve ficar às suas costas',
      body: 'Mantenha sempre uma rota de fuga livre atrás de você. Se o fogo não ceder, você recua com segurança, sem ficar encurralado.',
      buttons: [{ label: 'Continuar' }],
    });

    const q3 = await ui.ask(run, {
      title: 'Depois de usar',
      body: 'Você apagou um princípio de incêndio e sobrou um pouco de carga no extintor. O que fazer com ele?',
      columns: 1,
      buttons: [
        { label: 'Guardar de volta no lugar', value: 'guardar' },
        { label: 'Avisar o responsável e enviar para recarga', value: 'recarga' },
      ],
    });
    record(fase, 'Enviar o extintor usado para recarga', q3 === 'recarga');
    await ui.ask(run, {
      tone: q3 === 'recarga' ? 'success' : 'warning',
      title: q3 === 'recarga' ? 'Correto!' : 'Ele precisa de recarga',
      body: 'Extintor usado, mesmo que só um pouco, perde pressão e deve ser recarregado. Um extintor vazio no lugar dá uma falsa sensação de segurança.',
      buttons: [{ label: 'Ver resultado' }],
    });
  };

  // ------------------------------------------------------------------ Execução
  const fases = [fase1, fase2, fase3, fase4];
  const inicio = clamp(opts.startPhase || 1, 1, fases.length);
  for (const f of fases.slice(inicio - 1)) await f();
  await showResults(g, run, results, [
    'Excelente! Você sabe usar o extintor com segurança.',
    'Bom trabalho! Revise os pontos abaixo.',
    'Atenção! Revise a técnica antes de precisar usar um extintor.',
    'Vamos treinar mais? Usar o extintor errado pode piorar o incêndio.',
  ]);
}
