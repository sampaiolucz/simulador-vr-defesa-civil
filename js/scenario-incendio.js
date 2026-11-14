// Cenário 1 — Incêndio residencial
// Fases: 1) Prevenção  2) Fogo na panela  3) Fuga com fumaça  4) Acionamento do socorro  → Resultado
//
// IMPORTANTE: os textos educativos abaixo devem ser revisados pela equipe da Defesa Civil /
// Corpo de Bombeiros antes do uso público. Eles estão concentrados neste arquivo para facilitar a revisão.
import * as THREE from 'three';
import { makeWaypoint } from './world.js';
import { createCheckSprite } from './ui.js';
import { Aborted, clamp, yawTo } from './util.js';

export const FASES_INCENDIO = ['Prevenção', 'Fogo na panela', 'Fuga com fumaça', 'Pedir socorro'];

/** opts.startPhase: 1 a 4 — permite começar direto de uma fase (útil em palestras curtas). */
export async function runIncendio(g, run, opts = {}) {
  const { world, ui, sfx, fx } = g;
  const O = world.o;
  const results = []; // { fase, text, ok, pts, max }

  const record = (fase, text, ok, max = 1, pts = ok ? max : 0) => results.push({ fase, text, ok, pts, max });

  /** Registra objeto interativo que é removido automaticamente ao reiniciar. */
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

  const addWaypoint = (x, z, yaw) => {
    const wp = makeWaypoint(x, z);
    g.scene.add(wp);
    const rm = g.interact.add(wp, { label: 'Ir para cá', onSelect: () => g.teleport(x, z, yaw) });
    const head = new THREE.Vector3();
    const unhook = run.onFrame((dt, t) => {
      wp.userData.animate(t);
      g.player.headWorld(head);
      wp.visible = Math.hypot(head.x - x, head.z - z) > 0.7; // esconde o círculo onde a pessoa já está
    });
    const remove = () => {
      rm();
      unhook();
      g.scene.remove(wp);
    };
    run.onCleanup(remove);
    return remove;
  };

  // ------------------------------------------------------------------ Abertura
  world.reset();
  world.setNight(false);
  g.player.setPose(-2.5, -1.0, 0);
  await g.fade(0, 0.3);

  await ui.ask(run, {
    title: 'Simulador de Incêndio Residencial',
    body:
      'Defesa Civil de Cubatão\n\n' +
      'Você vai aprender a prevenir e a agir em um incêndio dentro de casa.\n\n' +
      'COMO INTERAGIR: aponte com a mão e junte o polegar e o indicador (gesto de pinça) para selecionar. ' +
      'Com controle: aponte e aperte o gatilho.\n\n' +
      'Para se mover, selecione os círculos azuis no chão.',
    buttons: [{ label: 'Começar' }],
    width: 1.25,
  });

  // ------------------------------------------------------------------ FASE 1 — Prevenção
  const fase1 = async () => {
    const fase = 'Prevenção';
    const hazards = [
      {
        obj: O.pan,
        label: 'Panela',
        short: 'Cabo da panela virado para fora',
        body: 'Alguém pode esbarrar ou uma criança pode puxar e derrubar óleo quente. Mantenha os cabos das panelas sempre virados para dentro do fogão.',
      },
      {
        obj: O.alcohol,
        label: 'Frasco de álcool',
        short: 'Álcool ao lado do fogão',
        body: 'Álcool, solventes e aerossóis são inflamáveis. Guarde longe do fogão e de qualquer chama, em local alto e fora do alcance de crianças.',
      },
      {
        obj: O.outlet,
        label: 'Tomada',
        short: 'Tomada sobrecarregada (benjamim)',
        body: 'Ligar vários aparelhos em benjamins ou “Ts” superaquece a fiação e pode causar incêndio. Use uma tomada para cada aparelho, principalmente os de alta potência.',
      },
      {
        obj: O.gas,
        label: 'Botijão de gás',
        short: 'Botijão e mangueira sem manutenção',
        body: 'Confira a validade impressa na mangueira e use registro com selo do Inmetro. Prefira manter o botijão em local ventilado. Sentiu cheiro de gás? Não acenda luzes nem fósforos, abra portas e janelas e feche o registro.',
      },
      {
        obj: O.candleSet,
        label: 'Vela acesa',
        short: 'Vela acesa perto da cortina',
        body: 'Nunca deixe velas acesas perto de cortinas e tecidos, nem sem ninguém olhando. Apague sempre antes de sair do cômodo ou dormir.',
      },
      {
        obj: O.lighter,
        label: 'Isqueiro e fósforos',
        short: 'Isqueiro e fósforos ao alcance de crianças',
        body: 'Isqueiros e fósforos devem ficar guardados em local alto e fechado. Crianças brincando com fogo causam muitos incêndios em casa.',
      },
    ];
    let found = 0;
    const finish = run.deferred();
    const hud = () => ui.setHud(['FASE 1 — PREVENÇÃO', `Riscos encontrados: ${found} de ${hazards.length}`]);

    await ui.ask(run, {
      title: 'Fase 1 — Prevenção',
      body:
        'Esta casa tem 6 situações de risco de incêndio. Encontre todas!\n\n' +
        'Aponte para os objetos e selecione os que oferecem perigo. Use os círculos azuis para ir até a sala.',
      buttons: [{ label: 'Procurar riscos' }],
    });
    hud();

    const markers = [];
    run.onCleanup(() => markers.forEach((m) => g.scene.remove(m)));

    for (const h of hazards) {
      on(h.obj, h.label, async () => {
        if (h.found) return;
        h.found = true;
        found++;
        const box = new THREE.Box3().setFromObject(h.obj);
        const mk = createCheckSprite();
        box.getCenter(mk.position);
        mk.position.y = box.max.y + 0.12;
        g.scene.add(mk);
        markers.push(mk);
        hud();
        await ui.ask(run, { tone: 'warning', title: 'Risco: ' + h.short, body: h.body, buttons: [{ label: 'Entendi' }] });
        if (found === hazards.length) finish.resolve();
      });
    }
    for (const [obj, label] of [
      [O.fridge, 'Geladeira'],
      [O.tv, 'Televisão'],
      [O.sofa, 'Sofá'],
    ]) {
      on(obj, label, () => {
        sfx.info();
        ui.showToast('Nada de errado aqui. Continue procurando!', 'info', 2.5);
      });
    }

    const wps = [
      addWaypoint(-2.5, -1.0, 0), // cozinha
      addWaypoint(1.2, -2.4, yawTo(3.7, -1.5)), // sala, perto da passagem
      addWaypoint(1.4, 1.6, yawTo(2.1, -3.1)), // sala, perto do sofá
    ];

    ui.setHudButton('Concluir fase', () => concluir().catch((e) => !(e instanceof Aborted) && console.error(e)));
    async function concluir() {
      if (finish.done) return;
      if (found < hazards.length) {
        const c = await ui.ask(run, {
          title: `Ainda faltam ${hazards.length - found} riscos`,
          body: 'Deseja continuar procurando ou concluir esta fase?',
          buttons: [
            { label: 'Continuar procurando', value: 'cont' },
            { label: 'Concluir assim mesmo', value: 'fim' },
          ],
          sound: false,
        });
        if (c === 'fim') finish.resolve();
      } else finish.resolve();
    }

    await finish.promise;
    ui.setHudButton(null);
    wps.forEach((rm) => rm());
    for (const h of hazards) {
      g.interact.remove(h.obj);
      record(fase, 'Risco: ' + h.short, !!h.found);
    }
    g.interact.remove(O.fridge);
    g.interact.remove(O.tv);
    g.interact.remove(O.sofa);

    await ui.ask(run, {
      tone: found === hazards.length ? 'success' : 'warning',
      title: `Você encontrou ${found} de ${hazards.length} riscos`,
      items: hazards.map((h) => ({ text: h.short, ok: !!h.found })),
      buttons: [{ label: 'Próxima fase' }],
    });
    markers.forEach((m) => g.scene.remove(m));
  };

  // ------------------------------------------------------------------ FASE 2 — Fogo na panela
  const fase2 = async () => {
    const fase = 'Fogo na panela';
    ui.setHud([]);
    await g.teleport(-2.7, -2.2, yawTo(-0.2, -1));
    await ui.ask(run, {
      title: 'Fase 2 — Fogo na panela',
      body:
        'Você está fritando batatas e se distrai com o celular. De repente, o óleo da panela pega fogo!\n\n' +
        'Aja rápido: aponte e selecione o que você faria. Pode ser mais de uma ação.',
      buttons: [{ label: 'Estou pronto' }],
    });

    world.setGas(true);
    const fire = fx.fire(O.panFirePos, { light: true, size: 0.2, height: 0.45, radius: 0.1 });
    fire.setIntensity(1, 0.8);
    sfx.setFire(1);
    sfx.whoosh(0.4);

    const st = { gasOff: false, covered: false, water: false, carried: false };
    const done = run.deferred();
    const LIMIT = 25;
    let t = 0;
    let coveredAt = -1;

    const hud = () => {
      if (done.done) return;
      const left = Math.max(0, Math.ceil(LIMIT - t));
      ui.setHud(['O ÓLEO PEGOU FOGO!', st.covered ? 'Fogo abafado — falta algo?' : `Selecione o que fazer · ${left} s`], 'danger');
    };
    hud();

    on(O.knobs, 'Botões do fogão', () => {
      if (st.gasOff || done.done) return;
      st.gasOff = true;
      world.setGas(false);
      sfx.good();
      if (st.covered) done.resolve('ok');
      else ui.showToast(['Gás desligado!', 'Mas o fogo continua: é preciso abafar as chamas.'], 'success', 4);
    });

    on(O.lid, 'Tampa da panela', async () => {
      if (st.covered || done.done) return;
      st.covered = true;
      coveredAt = t;
      const from = O.lid.position.clone();
      const to = O.pan.position.clone().add(new THREE.Vector3(0, 0.085, 0));
      g.tweens.add({
        duration: 0.6,
        update: (k) => {
          O.lid.position.lerpVectors(from, to, k);
          O.lid.position.y += Math.sin(k * Math.PI) * 0.15;
        },
      });
      await run.wait(0.5);
      fire.setIntensity(0, 1.0);
      sfx.setFire(0);
      sfx.good();
      if (st.gasOff) done.resolve('ok');
      else ui.showToast(['Fogo abafado!', 'Agora desligue o gás.'], 'success', 4);
      hud();
    });

    on(O.jug, 'Jarra com água', async () => {
      if (st.water || done.done) return;
      st.water = true;
      const from = O.jug.position.clone();
      const to = new THREE.Vector3(-2.75, 1.12, -3.5);
      await g.tweens.play({
        duration: 0.5,
        update: (k) => {
          O.jug.position.lerpVectors(from, to, k);
          O.jug.rotation.z = k * 1.5;
        },
      });
      // bola de fogo: a água vira vapor e espalha o óleo em chamas
      fire.setIntensity(5, 0.25);
      fire.speed = 1.6;
      sfx.whoosh(1.2);
      sfx.setFire(2);
      done.resolve('agua');
    });

    on(O.pan, 'Panela', async () => {
      if (done.done || st.covered) return;
      const c = await ui.ask(run, {
        title: 'Panela em chamas',
        body: 'O que você faz com a panela?',
        buttons: [
          { label: 'Levar a panela até a pia', value: 'pia' },
          { label: 'Deixar onde está', value: 'nao' },
        ],
        sound: false,
      });
      if (c === 'pia' && !done.done) {
        st.carried = true;
        fire.setIntensity(3.5, 0.3);
        sfx.whoosh(1);
        sfx.setFire(2);
        done.resolve('carregar');
      }
    });

    let shown = Math.ceil(LIMIT);
    run.onFrame((dt) => {
      if (done.done) return;
      if (!ui.modalOpen) t += dt;
      if (Math.ceil(LIMIT - t) !== shown) {
        shown = Math.ceil(LIMIT - t);
        hud();
      }
      if (st.covered && !st.gasOff && t - coveredAt > 10) done.resolve('semgas');
      else if (!st.covered && t >= LIMIT) done.resolve('tempo');
    });

    const outcome = await done.promise;
    for (const obj of [O.knobs, O.lid, O.jug, O.pan]) g.interact.remove(obj);

    if (outcome === 'agua' || outcome === 'carregar' || outcome === 'tempo') {
      ui.setHud(['O FOGO SE ESPALHOU!'], 'danger');
      await run.wait(0.8);
      fire.setIntensity(2.2, 1.5);
      fire.speed = 1;
      O.kitchenFireSpots.slice(1).forEach((p, i) => fx.fire(p, { size: 0.3, height: 0.7, radius: 0.22 }).setIntensity(1.5, 1.5 + i * 0.6));
      fx.smoke(new THREE.Vector3(-3, 1.8, -3.3), { count: 40, size: 0.8, height: 0.6, radius: 0.6 }).setIntensity(1, 1.5);
      await run.wait(2.5);
    } else {
      ui.setHud(['FOGO APAGADO!'], 'success');
      await run.wait(1.5);
    }

    const msgs = {
      ok: {
        tone: 'success',
        title: 'Muito bem!',
        body: 'Você desligou o gás e abafou o fogo com a tampa. Sem oxigênio, o fogo apaga.\n\nDeixe a panela tampada até esfriar — se tirar a tampa cedo, o óleo pode pegar fogo de novo.',
      },
      semgas: {
        tone: 'warning',
        title: 'Fogo abafado, mas faltou desligar o gás',
        body: 'Abafar com a tampa foi certo! Mas com o queimador ligado o óleo continua esquentando e pode voltar a pegar fogo. Sempre desligue o gás também.',
      },
      agua: {
        tone: 'danger',
        title: 'Nunca jogue água no óleo quente!',
        body: 'A água afunda no óleo, vira vapor na hora e espalha o óleo em chamas pelo ar, criando uma bola de fogo.\n\nO certo é: desligar o gás e abafar com uma tampa ou pano úmido.',
      },
      carregar: {
        tone: 'danger',
        title: 'Não carregue a panela em chamas!',
        body: 'Ao mover a panela, o óleo pode derramar, causar queimaduras graves e espalhar o fogo pela casa.\n\nO certo é: desligar o gás e abafar com uma tampa ou pano úmido, sem tirar a panela do lugar.',
      },
      tempo: {
        tone: 'danger',
        title: 'O fogo saiu do controle',
        body: 'No fogo em panela, a reação precisa ser rápida: desligue o gás e abafe com uma tampa ou pano úmido.\n\nSe o fogo fugir do controle, saia de casa, feche a porta do cômodo e ligue 193.',
      },
    };
    record(fase, 'Não jogou água no óleo quente', !st.water, 2);
    record(fase, 'Não tentou carregar a panela em chamas', !st.carried, 1);
    record(fase, 'Abafou o fogo com a tampa', st.covered, 2);
    record(fase, 'Desligou o gás', st.gasOff, 1);
    await ui.ask(run, { ...msgs[outcome], buttons: [{ label: 'Próxima fase' }] });
    ui.setHud([]);
  };

  // ------------------------------------------------------------------ FASE 3 — Fuga
  const fase3 = async () => {
    const fase = 'Fuga';
    await g.fade(1, 0.8);
    sfx.setFire(0);
    fx.clear();
    world.reset();
    world.setNight(true);
    O.hotGlow.visible = true;
    O.alarmLed.material.color.set(0xff2020);
    O.kitchenFireSpots.forEach((p, i) => fx.fire(p, { size: 0.32, height: 0.8, radius: 0.25, light: i === 0 }).setIntensity(1.6, 0.1));
    fx.smoke(new THREE.Vector3(-3.0, 0.05, 0.25), { count: 30, size: 0.35, height: 1.6, radius: 0.35, drift: new THREE.Vector3(0, 0, 0.6) }).setIntensity(1, 0.1);
    world.setSmoke(1.3);
    g.player.setPose(-1.9, 2.9, -0.39);
    sfx.setAlarm(true, 0.05);
    sfx.setFire(0.35);
    await g.fade(0, 1.0);

    await ui.ask(run, {
      tone: 'danger',
      title: 'Fase 3 — Fuga',
      body:
        'Madrugada. Você acorda com o alarme de fumaça tocando: um curto-circuito começou um incêndio na cozinha e a fumaça está tomando a casa.\n\n' +
        'Saia da casa com segurança!',
      buttons: [{ label: 'Vamos lá' }],
    });

    // Calibra a altura da fumaça pela altura de cada pessoa: é preciso se abaixar ~40 cm
    const h0 = g.isXR ? g.player.headHeight() : 1.6;
    const bottom = clamp(h0 - 0.4, 0.7, 1.4);
    world.setSmoke(bottom);

    const st = { checkedA: false, openedA: false, checkedB: false, bOpen: false, tookBag: false, smokeTime: 0 };
    let objective = 'Encontre uma saída segura';
    const hudNormal = () => ui.setHud(['FASE 3 — FUGA', objective], 'danger');
    hudNormal();

    let inSmoke = null;
    let coughT = 1;
    let praised = false;
    const head = new THREE.Vector3();
    const unhookSmoke = run.onFrame((dt) => {
      g.player.headWorld(head);
      const inside = head.x < 6.0 && head.x > -5 && Math.abs(head.z) < 4;
      const now = inside && head.y > O.smokeBottom;
      g.setSmokeOverlay(now ? 0.8 : 0);
      if (now && !ui.modalOpen) {
        st.smokeTime += dt;
        coughT -= dt;
        if (coughT <= 0) {
          sfx.cough();
          coughT = 2.8;
        }
      }
      if (now !== inSmoke) {
        inSmoke = now;
        if (now) ui.setHud(['VOCÊ ESTÁ NA FUMAÇA!', 'Abaixe-se: perto do chão o ar é mais limpo'], 'danger');
        else {
          hudNormal();
          if (!praised && st.smokeTime > 0) {
            praised = true;
            ui.showToast('Isso! Abaixado você respira menos fumaça.', 'success', 3);
          }
        }
      }
    });
    run.onCleanup(() => g.setSmokeOverlay(0));

    const exit = run.deferred();
    const fugaWps = [];

    const doorMenu = () =>
      ui.ask(run, {
        tone: 'warning',
        title: 'Uma porta fechada',
        body: 'O que você faz?',
        columns: 1,
        sound: false,
        buttons: [
          { label: 'Sentir a temperatura com o dorso da mão', value: 'check' },
          { label: 'Abrir a porta', value: 'open' },
          { label: 'Voltar', value: 'cancel' },
        ],
      });

    const openB = async () => {
      st.bOpen = true;
      g.interact.remove(O.doorB.pivot);
      await O.doorB.animate(g.tweens, O.doorOpenAngle, 1.0);
      objective = 'Vá até a porta da frente, abaixado';
      if (!inSmoke) hudNormal();
      fugaWps.push(addWaypoint(1.2, 2.0, yawTo(4.8, -2)));
      fugaWps.push(addWaypoint(5.0, 0.0, yawTo(1, 0)));
      on(O.bag, 'Bolsa e documentos', () => {
        st.tookBag = true;
        O.bag.visible = false;
        g.interact.remove(O.bag);
        sfx.bad();
        ui.showToast(['Não perca tempo pegando objetos!', 'Cada segundo conta: saia imediatamente.'], 'danger', 4);
      });
      on(O.doorFront.pivot, 'Porta da frente', async () => {
        if (exit.done) return;
        g.interact.remove(O.doorFront.pivot);
        await O.doorFront.animate(g.tweens, O.doorOpenAngle, 0.8);
        exit.resolve();
      });
    };

    on(O.doorA.pivot, 'Porta da cozinha', async () => {
      const c = await doorMenu();
      if (c === 'check') {
        st.checkedA = true;
        await ui.ask(run, {
          tone: 'danger',
          title: 'A porta está QUENTE!',
          body:
            'Há fogo do outro lado. NÃO abra! Abrir deixaria o fogo e a fumaça entrarem no quarto. Mantenha a porta fechada e procure outra saída.\n\n' +
            'Use o dorso da mão: ele sente melhor o calor e você protege a palma.',
          buttons: [{ label: 'Procurar outra saída' }],
        });
      } else if (c === 'open') {
        st.openedA = true;
        g.interact.remove(O.doorA.pivot);
        const burst = fx.fire(new THREE.Vector3(-3.0, 0.4, 0.25), { size: 0.45, height: 1.6, radius: 0.35 });
        O.doorA.animate(g.tweens, O.doorOpenAngle * 0.6, 0.35);
        burst.setIntensity(2.2, 0.3);
        sfx.whoosh(1.3);
        world.setSmoke(Math.max(0.6, O.smokeBottom - 0.25));
        await run.wait(1.4);
        await ui.ask(run, {
          tone: 'danger',
          title: 'Havia fogo atrás da porta!',
          body:
            'O fogo e a fumaça avançaram para o quarto. Antes de abrir qualquer porta, sinta a temperatura com o dorso da mão: se estiver quente, mantenha fechada e procure outra saída.',
          buttons: [{ label: 'Fechar a porta' }],
        });
        burst.setIntensity(0, 0.6);
        await O.doorA.animate(g.tweens, 0, 0.5);
        world.setSmoke(bottom);
      }
    });

    on(O.doorB.pivot, 'Porta da sala', async () => {
      const c = await doorMenu();
      if (c === 'check') {
        st.checkedB = true;
        await ui.ask(run, {
          tone: 'success',
          title: 'A porta está fria',
          body: 'Não há fogo logo atrás dela. Abra devagar, protegendo o corpo atrás da porta, e saia abaixado.',
          buttons: [{ label: 'Abrir a porta' }],
        });
        await openB();
      } else if (c === 'open') {
        await openB();
        ui.showToast(['Desta vez deu certo...', 'mas sempre sinta a porta antes de abrir.'], 'warning', 4);
      }
    });

    await exit.promise;
    fugaWps.forEach((rm) => rm());
    unhookSmoke();
    g.setSmokeOverlay(0);
    record(fase, 'Não abriu a porta com fogo atrás', !st.openedA, 2);
    record(fase, 'Sentiu a temperatura da porta antes de abrir', st.checkedB, 1);
    const smokePts = st.smokeTime <= 4 ? 2 : st.smokeTime <= 12 ? 1 : 0;
    record(fase, `Ficou abaixado na fumaça (${Math.round(st.smokeTime)} s respirando fumaça)`, smokePts === 2, 2, smokePts);
    record(fase, 'Não perdeu tempo pegando objetos', !st.tookBag, 1);
    for (const obj of [O.doorA.pivot, O.doorB.pivot, O.bag, O.doorFront.pivot]) g.interact.remove(obj);
    await g.fade(1, 0.6);
  };

  // ------------------------------------------------------------------ FASE 4 — Pedir socorro
  const fase4 = async () => {
    const fase = 'Pedir socorro';
    // garante o cenário noturno com fumaça mesmo quando a simulação começa direto nesta fase
    world.setNight(true);
    world.setSmoke(Math.min(O.smokeBottom, 1.2));
    O.doorFront.setAngle(O.doorOpenAngle);
    sfx.setAlarm(true, 0.012);
    sfx.setFire(0.15);
    fx.smoke(new THREE.Vector3(6.2, 1.9, 0), { count: 40, size: 0.9, height: 2.5, radius: 0.3, drift: new THREE.Vector3(1.2, 0.5, 0) }).setIntensity(1, 0.1);
    fx.smoke(new THREE.Vector3(-2.5, 2.9, -2), { count: 40, size: 1.4, height: 4, radius: 1.2 }).setIntensity(1, 0.1);
    O.windowPane.material.color.set(0xff8a3d);
    g.player.setPose(10, 0.4, yawTo(-1, -0.05));
    ui.setHud(['FASE 4 — PEDIR SOCORRO']);
    await g.fade(0, 0.8);

    const q1 = await ui.ask(run, {
      tone: 'success',
      title: 'Você saiu da casa!',
      body: 'Afaste-se do imóvel e vá para um local seguro, como o ponto de encontro.\n\nAgora peça ajuda. Para qual número você liga?',
      buttons: [
        { label: '190 – Polícia Militar', value: 190 },
        { label: '192 – SAMU', value: 192 },
        { label: '193 – Bombeiros', value: 193 },
        { label: '199 – Defesa Civil', value: 199 },
      ],
      columns: 2,
    });
    const fb1 = {
      193: { tone: 'success', title: 'Correto: 193 — Corpo de Bombeiros', body: 'Em caso de incêndio, ligue 193. A ligação é gratuita e pode ser feita de qualquer telefone, mesmo sem crédito.' },
      199: { tone: 'warning', title: 'Quase! 199 é a Defesa Civil', body: 'A Defesa Civil atua em situações de risco como deslizamentos e enchentes. Para incêndio, chame o Corpo de Bombeiros: 193.' },
      192: { tone: 'warning', title: '192 é o SAMU', body: 'O SAMU atende emergências médicas — ligue também se houver feridos. Mas, para o incêndio, chame os Bombeiros: 193.' },
      190: { tone: 'warning', title: '190 é a Polícia Militar', body: 'Para incêndio, o número certo é 193, do Corpo de Bombeiros.' },
    }[q1];
    record(fase, 'Ligou para o 193 (Bombeiros)', q1 === 193);
    await ui.ask(run, { ...fb1, buttons: [{ label: 'Continuar' }] });

    const q2 = await ui.ask(run, {
      title: 'Na ligação',
      body: 'O atendente do 193 atendeu. O que é mais importante informar primeiro?',
      columns: 1,
      buttons: [
        { label: 'Como o fogo começou, em detalhes', value: 'como' },
        { label: 'Endereço completo e um ponto de referência', value: 'end' },
        { label: 'Meu CPF e documentos', value: 'cpf' },
      ],
    });
    record(fase, 'Informou o endereço e um ponto de referência', q2 === 'end');
    await ui.ask(run, {
      tone: q2 === 'end' ? 'success' : 'warning',
      title: q2 === 'end' ? 'Isso mesmo!' : 'O mais importante é o endereço',
      body:
        'Com o endereço completo e um ponto de referência o socorro chega mais rápido. Depois informe se há pessoas ou animais no imóvel e o que está queimando. Não desligue até o atendente orientar.',
      buttons: [{ label: 'Continuar' }],
    });

    const q3 = await ui.ask(run, {
      title: 'E o seu cachorro?',
      body: 'Você percebe que o seu cachorro ficou dentro de casa. O que você faz?',
      columns: 1,
      buttons: [
        { label: 'Volto rapidinho para buscá-lo', value: 'voltar' },
        { label: 'Aviso os bombeiros que há um animal lá dentro', value: 'avisar' },
      ],
    });
    record(fase, 'Não voltou para dentro da casa', q3 === 'avisar');
    await ui.ask(run, {
      tone: q3 === 'avisar' ? 'success' : 'danger',
      title: q3 === 'avisar' ? 'Correto!' : 'Nunca volte para dentro!',
      body:
        'Nunca volte para um imóvel em chamas: a fumaça pode fazer você desmaiar em poucos segundos. Avise os bombeiros — eles têm equipamento de proteção para fazer o resgate.',
      buttons: [{ label: 'Ver resultado' }],
    });
  };

  // ------------------------------------------------------------------ Resultado
  const resultado = async () => {
    const total = results.reduce((s, r) => s + r.pts, 0);
    const max = results.reduce((s, r) => s + r.max, 0);
    const pct = total / max;
    const msg =
      pct >= 0.9
        ? 'Excelente! Você sabe prevenir e agir em um incêndio.'
        : pct >= 0.7
          ? 'Bom trabalho! Revise os pontos abaixo.'
          : pct >= 0.5
            ? 'Atenção! Alguns erros podem custar caro em uma emergência real.'
            : 'Vamos treinar mais? Em uma emergência real, cada decisão conta.';
    const fases = [...new Set(results.map((r) => r.fase))];
    const items = fases.map((f) => {
      const rs = results.filter((r) => r.fase === f);
      const p = rs.reduce((s, r) => s + r.pts, 0);
      const m = rs.reduce((s, r) => s + r.max, 0);
      return { text: `${f}: ${p} de ${m} pontos`, ok: p / m >= 0.7 };
    });
    const erros = results.filter((r) => !r.ok).map((r) => r.text);
    sfx.setAlarm(false);
    ui.setHud([]);
    const body =
      msg +
      (erros.length ? '\n\nPara revisar:\n' + erros.slice(0, 6).map((e) => '• ' + e).join('\n') + (erros.length > 6 ? `\n• e mais ${erros.length - 6}...` : '') : '\n\nVocê acertou tudo!');
    await ui.ask(run, {
      tone: pct >= 0.7 ? 'success' : 'warning',
      title: `Resultado: ${total} de ${max} pontos`,
      body,
      items,
      width: 1.35,
      buttons: [{ label: 'Jogar novamente' }],
    });
    g.restart();
  };

  // ------------------------------------------------------------------ Execução
  const fases = [fase1, fase2, fase3, fase4];
  const inicio = clamp(opts.startPhase || 1, 1, fases.length);
  for (const f of fases.slice(inicio - 1)) await f();
  await resultado();
}
