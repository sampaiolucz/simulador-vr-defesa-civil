// Cenário 4 — Enchente e alagamento (na casa do cenário de incêndio)
// Fases: 1) Preparação  2) A água está subindo  3) Na rua alagada  4) Depois da enchente → Resultado
//
// IMPORTANTE: os textos educativos estão concentrados neste arquivo e devem ser revisados pela
// equipe da Defesa Civil / Saúde antes do uso público.
import * as THREE from 'three';
import { makeWaypoint } from './world.js';
import { createCheckSprite } from './ui.js';
import { Aborted, clamp, yawTo } from './util.js';
import { createScore, showResults } from './results.js';

export const FASES_ENCHENTE = ['Preparação', 'A água está subindo', 'Na rua alagada', 'Depois da enchente'];

export async function runEnchente(g, run, opts = {}) {
  const { ui, sfx, fx, flood, world } = g;
  const O = world.o;
  const F = flood.o;
  const { results, record } = createScore();

  flood.group.visible = true;
  const bagHome = O.bag.position.clone(); // a bolsa é compartilhada com o cenário de incêndio
  run.onCleanup(() => {
    flood.reset();
    O.bag.position.copy(bagHome);
  });

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
  let moving = false;
  const addWaypoint = (x, z, lookX, lookZ, label = 'Ir para cá', onArrive) => {
    const wp = makeWaypoint(x, z);
    g.scene.add(wp);
    const rm = g.interact.add(wp, {
      label,
      onSelect: () => {
        if (moving) return;
        moving = true;
        return g
          .teleport(x, z, yawTo(lookX - x, lookZ - z))
          .then(() => {
            moving = false;
            if (onArrive) onArrive();
          })
          .catch((e) => {
            moving = false;
            if (!(e instanceof Aborted)) console.error(e);
          });
      },
    });
    const head = new THREE.Vector3();
    const unhook = run.onFrame((dt, t) => {
      wp.userData.animate(t);
      wp.position.y = flood.o.level; // o círculo fica sobre a água
      g.player.headWorld(head);
      wp.visible = Math.hypot(head.x - x, head.z - z) > 0.7;
    });
    const remove = () => {
      rm();
      unhook();
      g.scene.remove(wp);
    };
    run.onCleanup(remove);
    return remove;
  };
  const pose = (x, z, lx, lz) => g.player.setPose(x, z, yawTo(lx - x, lz - z));
  const goTo = (x, z, lx, lz) => g.teleport(x, z, yawTo(lx - x, lz - z));

  // ---------------------------------------------------------------- Clima
  const weather = { storm: false };
  const storm = () => {
    if (weather.storm) return;
    weather.storm = true;
    world.setNight(true);
    world.setSky({ bg: 0x1b2433, hemi: 0.8 });
    const rain = fx.rain(() => g.player.headWorld());
    sfx.setRain(1);
    // dentro de casa não chove (o teto protege); o som continua, mais abafado
    const head = new THREE.Vector3();
    let indoor = null;
    run.onFrame(() => {
      g.player.headWorld(head);
      const inside = head.x > -5 && head.x < 6 && Math.abs(head.z) < 4;
      if (inside !== indoor) {
        indoor = inside;
        rain.setIntensity(inside ? 0 : 1);
        sfx.setRain(inside ? 0.55 : 1);
      }
    });
    let next = 4;
    let flash = 0;
    weather.unhook = run.onFrame((dt) => {
      next -= dt;
      if (flash > 0) {
        flash -= dt;
        if (flash <= 0) world.setSky({ hemi: 0.8, bg: 0x1b2433 });
      }
      if (next <= 0) {
        next = 9 + Math.random() * 8;
        flash = 0.12;
        world.setSky({ hemi: 2.8, bg: 0x6b7a90 });
        setTimeout(() => sfx.rumble(0.4, 2.5), 800);
      }
    });
  };
  const clearSky = () => {
    if (weather.unhook) weather.unhook(); // para os relâmpagos
    weather.unhook = null;
    weather.storm = false;
    world.setNight(false);
    sfx.setRain(0);
    fx.clear();
  };
  run.onFrame((dt, t) => flood.update(dt, t));

  /** Fase de procurar/agir sobre objetos (fases 1 e 4). */
  const searchPhase = async ({ fase, hudTitle, items, waypoints, tone = 'info', prefix = '' }) => {
    let found = 0;
    const finish = run.deferred();
    const hud = () => ui.setHud([hudTitle, `Feito: ${found} de ${items.length}`]);
    hud();
    const markers = [];
    run.onCleanup(() => markers.forEach((m) => g.scene.remove(m)));
    for (const h of items) {
      on(h.obj, h.label, async () => {
        if (h.found) return;
        h.found = true;
        found++;
        const b = new THREE.Box3().setFromObject(h.obj);
        const mk = createCheckSprite();
        b.getCenter(mk.position);
        mk.position.y = Math.min(b.max.y + 0.15, mk.position.y + 1.2);
        g.scene.add(mk);
        markers.push(mk);
        hud();
        sfx.good();
        if (h.action) await h.action();
        await ui.ask(run, { tone, title: prefix + h.short, body: h.body, buttons: [{ label: 'Entendi' }], sound: false });
        if (found === items.length) finish.resolve();
      });
    }
    const wps = waypoints.map((w) => addWaypoint(...w));
    ui.setHudButton('Concluir fase', () =>
      (async () => {
        if (finish.done) return;
        if (found < items.length) {
          const c = await ui.ask(run, {
            title: `Ainda faltam ${items.length - found}`,
            body: 'Deseja continuar ou concluir esta fase?',
            buttons: [
              { label: 'Continuar', value: 'cont' },
              { label: 'Concluir assim mesmo', value: 'fim' },
            ],
            sound: false,
          });
          if (c === 'fim') finish.resolve();
        } else finish.resolve();
      })().catch((e) => !(e instanceof Aborted) && console.error(e))
    );
    await finish.promise;
    ui.setHudButton(null);
    wps.forEach((rm) => rm());
    for (const h of items) {
      g.interact.remove(h.obj);
      record(fase, h.short, !!h.found);
    }
    markers.forEach((m) => g.scene.remove(m));
    return found;
  };

  // ---------------------------------------------------------------- Abertura
  world.reset();
  flood.reset();
  flood.group.visible = true;
  O.meetingSign.visible = false; // na enchente o destino é o abrigo (placa de rota de fuga)
  pose(2.2, 1.6, 4, -2);
  await g.fade(0, 0.5);
  await ui.ask(run, {
    title: 'Enchente e Alagamento',
    body:
      'Defesa Civil de Cubatão\n\n' +
      'Nesta simulação você vai preparar a casa para a época de chuvas, agir quando a água começar a subir, sair com segurança pela rua alagada e saber o que fazer depois.\n\n' +
      (g.isXR ? 'Aponte e faça a pinça para selecionar. Use os círculos azuis para se mover.' : 'Clique para selecionar e use os círculos azuis para se mover.'),
    buttons: [{ label: 'Começar' }],
    width: 1.25,
  });

  // ---------------------------------------------------------------- FASE 1 — Preparação
  const fase1 = async () => {
    O.doorFront.setAngle(O.doorOpenAngle);
    await goTo(2.2, 1.6, 4, -2);
    await ui.ask(run, {
      title: 'Fase 1 — Preparação',
      body:
        'A época de chuvas está chegando e esta rua costuma alagar.\n\n' +
        'Prepare a casa: encontre e selecione as 4 coisas que precisam ser feitas. Uma delas fica lá fora, na calçada.',
      buttons: [{ label: 'Preparar a casa' }],
    });
    const items = [
      {
        obj: O.bag,
        label: 'Bolsa e documentos',
        short: 'Documentos em saco plástico, no alto',
        body: 'Guarde documentos, receitas e objetos de valor em sacos plásticos fechados e em lugares altos. Assim eles não se perdem se a água entrar.',
        action: () => {
          const from = O.bag.position.clone();
          return g.tweens.play({ duration: 0.8, update: (k) => O.bag.position.lerpVectors(from, F.shelfSpot, k) });
        },
      },
      {
        obj: F.strip,
        label: 'Extensão no chão',
        short: 'Extensões e aparelhos fora do chão',
        body: 'Extensões, benjamins e aparelhos no chão entram em contato com a água e podem causar choque e curto-circuito. Deixe tomadas, fios e eletrodomésticos no alto.',
        action: () => {
          const from = F.strip.position.clone();
          const to = new THREE.Vector3(F.stripHome.x, 1.0, -3.85);
          return g.tweens.play({ duration: 0.6, update: (k) => F.strip.position.lerpVectors(from, to, k) });
        },
      },
      {
        obj: F.kit,
        label: 'Mochila',
        short: 'Kit de emergência pronto',
        body: 'Monte uma mochila com: documentos em saco plástico, remédios de uso contínuo, lanterna e pilhas, água potável, alimentos que não estragam, carregador e uma muda de roupa. Deixe perto da porta.',
      },
      {
        obj: F.drain,
        label: 'Bueiro na calçada',
        short: 'Bueiro entupido de lixo',
        body: 'Lixo jogado na rua entope bueiros e bocas de lobo, e a água da chuva não tem para onde ir. Nunca jogue lixo na rua, em córregos ou canais.\n\nBueiro entupido? Avise a Prefeitura.',
        action: () => F.drainTrash.forEach((m) => (m.visible = false)),
      },
    ];
    const found = await searchPhase({
      fase: 'Preparação',
      hudTitle: 'FASE 1 — PREPARAÇÃO',
      items,
      tone: 'success',
      waypoints: [
        [2.2, 1.6, 4, -2], // sala
        [4.6, -1.2, 1, -3.5], // perto da TV
        [9.0, 0.4, 13.5, 1.6], // calçada, em frente à casa
      ],
    });
    await ui.ask(run, {
      tone: found === items.length ? 'success' : 'warning',
      title: `Casa preparada: ${found} de ${items.length}`,
      items: items.map((h) => ({ text: h.short, ok: !!h.found })),
      body: 'Dica: cadastre o CEP da sua casa no SMS 40199 para receber os alertas da Defesa Civil.',
      buttons: [{ label: 'Próxima fase' }],
    });
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 2 — A água está subindo
  const fase2 = async () => {
    const fase = 'A água está subindo';
    await g.fade(1, 0.6);
    storm();
    O.doorFront.setAngle(0);
    F.kit.visible = true;
    flood.setLevel(0.02);
    pose(3.8, -0.8, 6, -2.2);
    await g.fade(0, 0.8);
    await ui.ask(run, {
      tone: 'warning',
      title: 'Fase 2 — A água está subindo',
      body:
        'Chove forte há horas. A rua já está alagada e a água começa a entrar por baixo da porta.\n\n' +
        'Aja rápido: o que você faz antes de a água subir? Selecione o que for importante. Quando estiver pronto, use “Sair de casa”.',
      buttons: [{ label: 'Agir' }],
    });

    const st = { energia: null, gas: false, kit: false };
    const RISE_TIME = 55; // segundos para a água chegar a ~45 cm
    let level = 0.02;
    const decide = run.deferred();
    const hud = () => {
      const cm = Math.round(level * 100);
      ui.setHud(['A ÁGUA ESTÁ SUBINDO', `Nível dentro de casa: ${cm} cm`], cm >= 25 ? 'danger' : 'warning');
    };
    let shown = -1;
    run.onFrame((dt) => {
      if (decide.done || ui.modalOpen) return;
      level = Math.min(0.48, level + (0.46 / RISE_TIME) * dt);
      flood.setLevel(level);
      const cm = Math.round(level * 100);
      if (cm !== shown) {
        shown = cm;
        hud();
      }
      if (level >= 0.45) decide.resolve('auto');
    });
    hud();

    on(F.panel, 'Quadro de luz', async () => {
      if (st.energia !== null) return;
      if (level < 0.15) {
        st.energia = true;
        flood.setBreaker(true);
        sfx.click();
        await ui.ask(run, {
          tone: 'success',
          title: 'Energia desligada',
          body: 'Você desligou o disjuntor geral enquanto ainda estava com os pés secos. Isso evita choques e curtos-circuitos quando a água chega às tomadas.',
          buttons: [{ label: 'Continuar' }],
          sound: false,
        });
      } else {
        st.energia = false;
        sfx.bad();
        await ui.ask(run, {
          tone: 'danger',
          title: 'Não mexa no quadro com os pés na água!',
          body: 'Com a água no chão, mexer no quadro de luz pode causar choque elétrico. O disjuntor deve ser desligado ANTES de a água entrar, com os pés secos.\n\nAgora, saia de casa e peça ajuda à companhia de energia ou ao 193.',
          buttons: [{ label: 'Entendi' }],
          sound: false,
        });
      }
    });
    on(O.gas, 'Botijão de gás', async () => {
      if (st.gas) return;
      st.gas = true;
      sfx.good();
      ui.showToast(['Registro do gás fechado!', 'Evita vazamento se o botijão tombar ou a mangueira soltar.'], 'success', 4);
    });
    on(F.kit, 'Kit de emergência', async () => {
      if (st.kit) return;
      st.kit = true;
      F.kit.visible = false;
      sfx.good();
      ui.showToast(['Kit de emergência na mão!', 'Documentos, remédios, lanterna e água.'], 'success', 4);
    });
    const wps = [addWaypoint(3.8, -0.8, 6, -2.2), addWaypoint(-2.6, -1.4, -4.6, -2.85), addWaypoint(3.0, 1.6, 3.5, 2.6)];
    ui.setHudButton('Sair de casa', () => decide.resolve('botao'));

    await decide.promise;
    ui.setHudButton(null);
    wps.forEach((r) => r());
    [F.panel, O.gas, F.kit].forEach((o) => g.interact.remove(o));

    const q = await ui.ask(run, {
      tone: 'danger',
      title: 'A água continua subindo',
      body: 'A Defesa Civil orienta os moradores da rua a irem para o abrigo. O que você faz?',
      columns: 1,
      buttons: [
        { label: 'Fico para levantar os móveis', value: 'moveis' },
        { label: 'Espero a água baixar dentro de casa', value: 'esperar' },
        { label: 'Saio agora, com o kit, para o abrigo', value: 'sair' },
      ],
    });
    record(fase, 'Desligou a energia com os pés secos', st.energia === true, 2);
    record(fase, 'Fechou o registro do gás', st.gas);
    record(fase, 'Pegou o kit de emergência', st.kit);
    record(fase, 'Saiu quando a Defesa Civil orientou', q === 'sair', 2);
    await ui.ask(run, {
      tone: q === 'sair' ? 'success' : 'danger',
      title: q === 'sair' ? 'Decisão certa!' : 'Não espere a água subir mais!',
      body:
        'Quando a Defesa Civil orientar a saída, saia logo, enquanto a água ainda está baixa. Móveis se recuperam; vidas, não.\n\n' +
        'Se ficar ilhado e a água subir muito, vá para o ponto mais alto da casa e ligue 193.',
      buttons: [{ label: 'Sair de casa' }],
    });
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 3 — Na rua alagada
  const fase3 = async () => {
    const fase = 'Na rua alagada';
    await g.fade(1, 0.5);
    storm();
    flood.setLevel(0.5);
    O.doorFront.setAngle(O.doorOpenAngle);
    F.car.visible = true;
    F.wire.visible = true;
    F.swirl.visible = true;
    const sparks = fx.sparks(F.wireEnd, { radius: 0.15, height: 0.4, size: 0.09 });
    sparks.setIntensity(1.6, 0.3);
    pose(8.4, 0.4, 16, 0);
    await g.fade(0, 0.6);
    await ui.ask(run, {
      tone: 'warning',
      title: 'Fase 3 — Na rua alagada',
      body:
        'Você saiu de casa. A água está na altura dos joelhos e corre forte pela rua.\n\n' +
        'Antes de seguir, observe bem: há 2 perigos escondidos na água. Encontre os dois.',
      buttons: [{ label: 'Observar' }],
    });
    const perigos = [
      {
        obj: F.wire,
        label: 'Fio caído',
        short: 'Fio elétrico caído na água',
        body: 'A água conduz eletricidade: chegar perto de um fio caído pode ser fatal. Afaste-se e avise a companhia de energia, os Bombeiros (193) ou a Defesa Civil (199).',
      },
      {
        obj: F.swirl,
        label: 'Redemoinho na água',
        short: 'Redemoinho: bueiro destampado',
        body: 'Redemoinhos indicam bueiros ou bocas de lobo destampados, escondidos pela água. A pessoa pode cair e ser puxada. Por isso nunca ande por áreas alagadas.',
      },
    ];
    let found = 0;
    const achou = run.deferred();
    const hud = () => ui.setHud(['FASE 3 — NA RUA ALAGADA', `Perigos encontrados: ${found} de 2`], 'danger');
    hud();
    for (const p of perigos) {
      on(p.obj, p.label, async () => {
        if (p.found) return;
        p.found = true;
        found++;
        hud();
        sfx.good();
        await ui.ask(run, { tone: 'danger', title: 'Perigo: ' + p.short, body: p.body, buttons: [{ label: 'Entendi' }], sound: false });
        if (found === 2) achou.resolve();
      });
    }
    ui.setHudButton('Seguir em frente', () => achou.resolve());
    await achou.promise;
    ui.setHudButton(null);
    perigos.forEach((p) => {
      g.interact.remove(p.obj);
      record(fase, 'Percebeu: ' + p.short, !!p.found);
    });

    const qc = await ui.ask(run, {
      title: 'O carro na água',
      body: 'Um motorista quer atravessar a rua alagada com o carro. O que ele deve fazer?',
      columns: 1,
      buttons: [
        { label: 'Acelerar para passar bem rápido', value: 'acelerar' },
        { label: 'Não atravessar e procurar outro caminho', value: 'voltar' },
      ],
    });
    record(fase, 'Sabe que carro não deve atravessar alagamento', qc === 'voltar');
    await ui.ask(run, {
      tone: qc === 'voltar' ? 'success' : 'danger',
      title: qc === 'voltar' ? 'Correto!' : 'Nunca atravesse!',
      body: 'Apenas 15 cm de água em movimento podem derrubar um adulto, e uns 30 cm já podem arrastar um carro. Não dá para saber a profundidade nem se há buracos. Nunca atravesse áreas alagadas, nem a pé nem de carro.',
      buttons: [{ label: 'Continuar' }],
    });

    ui.setHud(['FASE 3 — NA RUA ALAGADA', 'Escolha o caminho até o abrigo'], 'danger');
    let first = null;
    let ok = false;
    while (!ok) {
      const ch = run.deferred();
      const r1 = addWaypoint(19.5, 2.0, 21, 6, 'Ir para cá', () => ch.resolve('atravessar'));
      const r2 = addWaypoint(12.8, 9.5, 12.8, 20, 'Ir para cá', () => ch.resolve('rota'));
      const c = await ch.promise;
      r1();
      r2();
      if (first === null) first = c;
      if (c === 'rota') ok = true;
      else {
        sfx.whoosh(0.5);
        await ui.ask(run, {
          tone: 'danger',
          title: 'A correnteza é forte demais!',
          body: 'No meio da rua a água está mais funda e corre mais rápido, e você não enxerga o chão. Volte para a calçada e siga a rota de fuga sinalizada, pelo caminho mais alto.',
          buttons: [{ label: 'Voltar para a calçada' }],
        });
        await goTo(8.4, 0.4, 16, 0);
      }
    }
    record(fase, 'Não atravessou a rua alagada', first === 'rota', 2);
    sparks.setIntensity(0, 0.3);
    await ui.ask(run, {
      tone: 'success',
      title: 'Você chegou ao abrigo!',
      body: 'Seguindo pela calçada e pela rota sinalizada, você chegou ao abrigo na parte alta do bairro. Aqui há equipes da Defesa Civil, água e um lugar seguro para esperar.',
      buttons: [{ label: 'Continuar' }],
    });
    F.car.visible = false;
    F.wire.visible = false;
    F.swirl.visible = false;
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 4 — Depois da enchente
  const fase4 = async () => {
    const fase = 'Depois da enchente';
    await g.fade(1, 0.6);
    clearSky();
    flood.setLevel(0);
    F.mud.visible = true;
    F.car.visible = false;
    F.wire.visible = false;
    F.swirl.visible = false;
    O.doorFront.setAngle(O.doorOpenAngle);
    pose(2.2, 1.6, 4, -2);
    await g.fade(0, 0.8);
    await ui.ask(run, {
      title: 'Fase 4 — Depois da enchente',
      body:
        'A água baixou e a Defesa Civil liberou a volta para casa. Ficou lama por todo lado: veja a marca da água nas paredes.\n\n' +
        'Encontre as 4 coisas que exigem cuidado antes de voltar a usar a casa.',
      buttons: [{ label: 'Começar a limpeza' }],
    });
    const items = [
      {
        obj: F.mud,
        label: 'Lama no chão',
        short: 'Limpar com proteção',
        body: 'A lama da enchente tem esgoto e urina de rato, que transmite a leptospirose. Limpe usando botas e luvas de borracha (ou sacos plásticos amarrados nos pés e nas mãos). Lave pisos, paredes e objetos com água e água sanitária.',
      },
      {
        obj: O.fridge,
        label: 'Geladeira',
        short: 'Jogar fora alimentos molhados',
        body: 'Alimentos que tiveram contato com a água da enchente devem ir para o lixo, mesmo que pareçam bons. Também descarte os que ficaram fora da geladeira sem energia por muito tempo.',
      },
      {
        obj: O.jug,
        label: 'Água para beber',
        short: 'Só beber água tratada',
        body: 'Beba apenas água mineral, fervida ou filtrada. Se não tiver, coloque 2 gotas de água sanitária para cada litro de água e espere 30 minutos antes de beber. Lave e desinfete a caixa d’água se a enchente chegou até ela.',
      },
      {
        obj: F.panel,
        label: 'Quadro de luz',
        short: 'Eletricista antes de religar',
        body: 'Antes de religar a energia, peça para um eletricista verificar a fiação, as tomadas e os aparelhos que molharam. Ligar tudo direto pode causar choque e incêndio.',
      },
    ];
    await searchPhase({
      fase,
      hudTitle: 'FASE 4 — DEPOIS DA ENCHENTE',
      items,
      tone: 'warning',
      waypoints: [
        [2.2, 1.6, 4, -2],
        [-2.5, -1.0, -2.5, -4],
        [4.6, -1.2, 6, -2.4],
      ],
    });
    const q = await ui.ask(run, {
      title: 'Uma semana depois',
      body: 'Dias depois da limpeza, você tem febre, dor de cabeça e muita dor nas panturrilhas (batata da perna). O que fazer?',
      columns: 1,
      buttons: [
        { label: 'Tomar um remédio por conta própria e esperar', value: 'remedio' },
        { label: 'Ir ao posto de saúde e contar que teve contato com a enchente', value: 'posto' },
      ],
    });
    record(fase, 'Procurou atendimento com sintomas de leptospirose', q === 'posto', 2);
    await ui.ask(run, {
      tone: q === 'posto' ? 'success' : 'danger',
      title: q === 'posto' ? 'Correto!' : 'Procure atendimento!',
      body: 'Febre, dor de cabeça e dor nas panturrilhas depois de contato com água de enchente podem ser leptospirose, que pode ser grave. Procure o posto de saúde e conte que teve contato com a enchente. Os sintomas podem aparecer até cerca de um mês depois.',
      buttons: [{ label: 'Ver resultado' }],
    });
  };

  // ---------------------------------------------------------------- Execução
  const fases = [fase1, fase2, fase3, fase4];
  const inicio = clamp(opts.startPhase || 1, 1, fases.length);
  for (const f of fases.slice(inicio - 1)) await f();
  await showResults(g, run, results, [
    'Excelente! Você sabe se preparar e agir numa enchente.',
    'Bom trabalho! Revise os pontos abaixo.',
    'Atenção! Na enchente, alguns erros podem ser fatais.',
    'Vamos treinar mais? Na água da enchente, cada decisão conta.',
  ]);
}
