// Cenário 5 — Vazamento de produto químico (caminhão-tanque tombado em frente à casa)
// Fases: 1) Identificar e se afastar  2) Abrigar-se em casa  3) Evacuação  4) Depois → Resultado
//
// Produto de exemplo: AMÔNIA — painel de segurança 268 (gás tóxico e corrosivo) / ONU 1005.
// IMPORTANTE: os textos educativos estão concentrados neste arquivo e devem ser revisados pela
// equipe da Defesa Civil antes do uso público.
import * as THREE from 'three';
import { makeWaypoint } from './world.js';
import { createCheckSprite } from './ui.js';
import { Aborted, clamp, yawTo } from './util.js';
import { createScore, showResults } from './results.js';

export const FASES_QUIMICO = ['Identificar e se afastar', 'Abrigar-se', 'Evacuação', 'Depois do vazamento'];

const NUVEM = [
  [0.7, 0.76, 0.48],
  [0.84, 0.87, 0.66],
];

export async function runQuimico(g, run, opts = {}) {
  const { ui, sfx, fx, chem, world } = g;
  const O = world.o;
  const C = chem.o;
  const { results, record } = createScore();

  world.reset();
  chem.group.visible = true;
  O.meetingSign.visible = false; // o destino aqui é o ponto indicado pela rota de fuga
  run.onCleanup(() => chem.reset());
  run.onFrame((dt, t) => chem.update(dt, t));

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
  const addWaypoint = (x, z, lx, lz, label = 'Ir para cá', onArrive) => {
    const wp = makeWaypoint(x, z);
    g.scene.add(wp);
    const rm = g.interact.add(wp, {
      label,
      onSelect: () => {
        if (moving) return;
        moving = true;
        return g
          .teleport(x, z, yawTo(lx - x, lz - z))
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
  const TRUCK = [17.6, -5];

  // ---------------------------------------------------------------- Nuvem tóxica
  const cloud = { emitters: [] };
  const startCloud = (k = 1) => {
    if (cloud.emitters.length) {
      cloud.emitters.forEach((e) => e.setIntensity(k, 1));
      return;
    }
    cloud.emitters = [
      fx.smoke(C.leak, { count: 70, size: 2.2, height: 2.0, radius: 0.8, lifespan: [4, 6], drift: new THREE.Vector3(-0.5, 0.8, -15), colors: NUVEM }),
      fx.smoke(C.leak.clone().add(new THREE.Vector3(0.5, -0.8, 1)), { count: 50, size: 1.6, height: 0.6, radius: 1.2, lifespan: [4, 6], drift: new THREE.Vector3(0.6, 0.2, -12), colors: NUVEM }),
    ];
    cloud.emitters.forEach((e) => e.setIntensity(k, 1));
  };
  /** Dentro da nuvem (na rua, no sentido do vento a partir do caminhão): névoa nos olhos e tosse. */
  const inCloudHook = () => {
    const head = new THREE.Vector3();
    let coughT = 0;
    return run.onFrame((dt) => {
      g.player.headWorld(head);
      const inside = head.x > 10.5 && head.z < -7.5 && head.z > -24;
      g.setSmokeOverlay(inside ? 0.55 : 0);
      if (inside) {
        coughT -= dt;
        if (coughT <= 0) {
          sfx.cough();
          coughT = 2.5;
        }
      }
    });
  };
  run.onCleanup(() => g.setSmokeOverlay(0));

  // ---------------------------------------------------------------- Abertura
  O.doorFront.setAngle(O.doorOpenAngle);
  O.doorB.setAngle(O.doorOpenAngle);
  pose(8.6, 1.4, TRUCK[0], TRUCK[1]);
  startCloud(1);
  sfx.setSpray(true); // chiado do gás escapando
  await g.fade(0, 0.5);
  await ui.ask(run, {
    title: 'Vazamento de Produto Químico',
    body:
      'Defesa Civil de Cubatão\n\n' +
      'Com o polo industrial e as rodovias, acidentes com produtos perigosos são um risco real em Cubatão. Nesta simulação você vai identificar o produto, se proteger, abrigar-se em casa, evacuar com segurança e saber o que fazer depois.\n\n' +
      (g.isXR ? 'Aponte e faça a pinça para selecionar. Use os círculos azuis para se mover.' : 'Clique para selecionar e use os círculos azuis para se mover.'),
    buttons: [{ label: 'Começar' }],
    width: 1.25,
  });

  // ---------------------------------------------------------------- FASE 1 — Identificar e se afastar
  const fase1 = async () => {
    const fase = 'Identificar e se afastar';
    await ui.ask(run, {
      tone: 'danger',
      title: 'Fase 1 — Acidente na rua',
      body:
        'Um caminhão-tanque tombou na rua em frente à sua casa e um gás está vazando.\n\n' +
        'Sem se aproximar, observe o caminhão: encontre o painel de segurança (placa laranja) e o rótulo de risco.',
      buttons: [{ label: 'Observar' }],
    });
    const itens = [
      {
        obj: C.plate,
        label: 'Placa laranja',
        short: 'Identificou o painel de segurança',
        title: 'Painel de segurança (placa laranja)',
        body:
          'Número de cima (268): o tipo de risco. O 2 indica gás, o 6 indica que é tóxico e o 8, corrosivo.\n' +
          'Número de baixo (1005): o número ONU do produto. É a AMÔNIA.\n\n' +
          'Não precisa decorar: anote ou fotografe de longe e informe ao 193.',
      },
      {
        obj: C.label,
        label: 'Rótulo de risco',
        short: 'Identificou o rótulo de risco',
        title: 'Rótulo de risco',
        body: 'O losango com a caveira e o número 2 indica GÁS TÓXICO. Esses rótulos mostram o tipo de perigo do produto transportado.',
      },
    ];
    let found = 0;
    const pronto = run.deferred();
    const hud = () => ui.setHud(['FASE 1 — IDENTIFICAR', `Encontrados: ${found} de 2`], 'danger');
    hud();
    const markers = [];
    run.onCleanup(() => markers.forEach((m) => g.scene.remove(m)));
    for (const it of itens) {
      on(it.obj, it.label, async () => {
        if (it.found) return;
        it.found = true;
        found++;
        const b = new THREE.Box3().setFromObject(it.obj);
        const mk = createCheckSprite();
        b.getCenter(mk.position);
        mk.position.y = b.max.y + 0.2;
        mk.scale.setScalar(0.3);
        g.scene.add(mk);
        markers.push(mk);
        hud();
        sfx.good();
        await ui.ask(run, { tone: 'warning', title: it.title, body: it.body, buttons: [{ label: 'Entendi' }], sound: false });
        if (found === 2) pronto.resolve();
      });
    }
    ui.setHudButton('Continuar', () => pronto.resolve());
    await pronto.promise;
    ui.setHudButton(null);
    itens.forEach((it) => {
      g.interact.remove(it.obj);
      record(fase, it.short, !!it.found);
    });

    const q1 = await ui.ask(run, {
      tone: 'danger',
      title: 'O que você faz agora?',
      body: 'O motorista já saiu da cabine e está andando para longe do caminhão. Curiosos começam a se aproximar.',
      columns: 1,
      buttons: [
        { label: 'Chego perto para ajudar a conter o vazamento', value: 'perto' },
        { label: 'Filmo de perto para avisar nas redes sociais', value: 'filmar' },
        { label: 'Me afasto, aviso os curiosos e ligo 193', value: 'afastar' },
      ],
    });
    record(fase, 'Afastou-se e acionou o 193', q1 === 'afastar', 2);
    await ui.ask(run, {
      tone: q1 === 'afastar' ? 'success' : 'danger',
      title: q1 === 'afastar' ? 'Isso mesmo!' : 'Nunca se aproxime!',
      body: 'Muitos produtos perigosos são invisíveis ou sem cheiro e podem intoxicar em segundos. Conter o vazamento é trabalho dos Bombeiros, com roupas e equipamentos especiais. Afaste-se, mantenha as pessoas longe e ligue 193.',
      buttons: [{ label: 'Escolher para onde ir' }],
    });

    // para onde se afastar? a biruta e a nuvem mostram o vento
    ui.setHud(['FASE 1 — AFASTE-SE', 'Observe a biruta e a nuvem: para onde vai o vento?'], 'danger');
    const unhookCloud = inCloudHook();
    let first = null;
    let ok = false;
    while (!ok) {
      const ch = run.deferred();
      const rs = [
        addWaypoint(12.8, -14, TRUCK[0], TRUCK[1], 'Ir para cá', () => ch.resolve('sentido')),
        addWaypoint(15.2, -1.6, TRUCK[0], TRUCK[1], 'Ir para cá', () => ch.resolve('perto')),
        addWaypoint(12.8, 9.5, TRUCK[0], TRUCK[1], 'Ir para cá', () => ch.resolve('contra')),
      ];
      const c = await ch.promise;
      rs.forEach((r) => r());
      if (first === null) first = c;
      if (c === 'contra') ok = true;
      else {
        sfx.bad();
        await run.wait(1.2);
        await ui.ask(run, {
          tone: 'danger',
          title: c === 'sentido' ? 'Você foi na direção da nuvem!' : 'Perto demais!',
          body:
            c === 'sentido'
              ? 'O vento leva a nuvem tóxica justamente para este lado. A biruta aponta para onde o vento vai: fique do lado oposto, de onde o vento vem.'
              : 'Aqui você está a poucos metros do vazamento. Afaste-se bastante e fique do lado de onde o vento vem.',
          buttons: [{ label: 'Escolher outro lugar' }],
        });
        await goTo(8.6, 1.4, TRUCK[0], TRUCK[1]);
      }
    }
    unhookCloud();
    g.setSmokeOverlay(0);
    record(fase, 'Ficou do lado de onde vem o vento', first === 'contra', 2);

    const q2 = await ui.ask(run, {
      title: 'Ligação para o 193',
      body: 'O atendente pergunta o que está acontecendo. O que você informa?',
      columns: 1,
      buttons: [
        { label: 'Só que tem um caminhão vazando', value: 'pouco' },
        { label: 'O local exato, os números da placa laranja (268 e 1005) e se há feridos', value: 'completo' },
      ],
    });
    record(fase, 'Informou o local e os números da placa', q2 === 'completo');
    await ui.ask(run, {
      tone: q2 === 'completo' ? 'success' : 'warning',
      title: q2 === 'completo' ? 'Perfeito!' : 'Dê o máximo de informações',
      body: 'Com os números da placa laranja, os Bombeiros sabem qual é o produto antes de chegar e já vêm com o equipamento certo. Informe também o local exato e se há pessoas feridas.',
      buttons: [{ label: 'Próxima fase' }],
    });
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 2 — Abrigar-se
  const fase2 = async () => {
    const fase = 'Abrigar-se';
    await g.fade(1, 0.5);
    startCloud(1.3);
    O.doorFront.setAngle(O.doorOpenAngle);
    O.doorB.setAngle(O.doorOpenAngle);
    chem.setWindow(false);
    chem.setFan(true);
    pose(3.0, 0.8, 4.9, -3.9);
    sfx.setSpray(false);
    sfx.setSiren(true, 0.05);
    await g.fade(0, 0.6);
    await ui.ask(run, {
      tone: 'danger',
      title: 'ALERTA DA DEFESA CIVIL',
      body:
        'Seu celular vibra e a sirene toca:\n“DEFESA CIVIL: vazamento de produto químico na sua região. ABRIGUE-SE: fique em local fechado, feche portas e janelas e aguarde orientações.”\n\n' +
        'Você está em casa. Prepare o abrigo: encontre as 5 ações.',
      buttons: [{ label: 'Abrigar-me' }],
    });
    const itens = [
      {
        obj: O.doorFront.pivot,
        label: 'Porta da frente',
        short: 'Fechar a porta',
        body: 'Feche as portas para impedir que o gás entre na casa.',
        action: () => O.doorFront.animate(g.tweens, 0, 0.7),
      },
      {
        obj: C.window,
        label: 'Janela',
        short: 'Fechar as janelas',
        body: 'Feche todas as janelas, inclusive basculantes de banheiro e cozinha.',
        action: () => {
          const from = C.sash.position.x;
          return g.tweens.play({ duration: 0.6, update: (k) => (C.sash.position.x = from + (C.sashClosedX - from) * k) });
        },
      },
      {
        obj: C.fan,
        label: 'Ventilador',
        short: 'Desligar ventilador e ar-condicionado',
        body: 'Desligue ventiladores, ar-condicionado e exaustores: eles puxam o ar de fora para dentro de casa.',
        action: () => chem.setFan(false),
      },
      {
        obj: C.towel,
        label: 'Pano molhado',
        short: 'Vedar as frestas',
        body: 'Vede as frestas das portas e janelas com panos molhados ou fita adesiva. Quanto menos ar de fora entrar, melhor.',
        action: () => {
          const from = C.towel.position.clone();
          return g.tweens.play({ duration: 0.6, update: (k) => C.towel.position.lerpVectors(from, C.towelDoor, k) });
        },
      },
      {
        obj: C.radio,
        label: 'Rádio',
        short: 'Ficar num cômodo interno, acompanhando as notícias',
        body: 'Fique num cômodo interno, com poucas janelas, e acompanhe as orientações pelo rádio, TV ou celular. Só saia quando a Defesa Civil mandar.',
      },
    ];
    let found = 0;
    const fim = run.deferred();
    const hud = () => ui.setHud(['FASE 2 — ABRIGAR-SE', `Ações: ${found} de 5`], 'danger');
    hud();
    for (const it of itens) {
      on(it.obj, it.label, async () => {
        if (it.found) return;
        it.found = true;
        found++;
        hud();
        sfx.good();
        if (it.action) await it.action();
        await ui.ask(run, { tone: 'success', title: it.short, body: it.body, buttons: [{ label: 'Ok' }], sound: false });
        if (found === 5) fim.resolve();
      });
    }
    const wps = [addWaypoint(3.0, 0.8, 4.9, -3.9), addWaypoint(4.6, 0.6, 6, 0), addWaypoint(-1.6, 2.4, -2.2, 3.65)];
    ui.setHudButton('Concluir fase', () =>
      (async () => {
        if (fim.done) return;
        if (found < 5) {
          const c = await ui.ask(run, {
            title: `Ainda faltam ${5 - found} ações`,
            body: 'Deseja continuar preparando o abrigo ou concluir?',
            buttons: [
              { label: 'Continuar', value: 'cont' },
              { label: 'Concluir assim mesmo', value: 'fim' },
            ],
            sound: false,
          });
          if (c === 'fim') fim.resolve();
        } else fim.resolve();
      })().catch((e) => !(e instanceof Aborted) && console.error(e))
    );
    await fim.promise;
    ui.setHudButton(null);
    wps.forEach((r) => r());
    itens.forEach((it) => {
      g.interact.remove(it.obj);
      record(fase, it.short, !!it.found);
    });

    const qe = await ui.ask(run, {
      title: 'E as crianças?',
      body: 'Seu filho está na escola, a poucos quarteirões daqui. O que você faz?',
      columns: 1,
      buttons: [
        { label: 'Saio agora para buscá-lo', value: 'buscar' },
        { label: 'Fico abrigado: a escola tem plano de emergência', value: 'ficar' },
      ],
    });
    record(fase, 'Não saiu para buscar o filho na escola', qe === 'ficar', 2);
    await ui.ask(run, {
      tone: qe === 'ficar' ? 'success' : 'danger',
      title: qe === 'ficar' ? 'Difícil, mas correto!' : 'Não saia do abrigo!',
      body: 'Saindo, você se expõe ao gás e pode atrapalhar o socorro. As escolas seguem o plano de emergência e abrigam os alunos. Aguarde as orientações e use o telefone só se for necessário, para não congestionar as linhas.',
      buttons: [{ label: 'Próxima fase' }],
    });
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 3 — Evacuação
  const fase3 = async () => {
    const fase = 'Evacuação';
    await g.fade(1, 0.5);
    startCloud(1.1);
    O.doorFront.setAngle(O.doorOpenAngle);
    pose(8.6, 1.4, 12.3, 4.6);
    sfx.setSiren(true, 0.05);
    await g.fade(0, 0.6);
    await ui.ask(run, {
      tone: 'danger',
      title: 'Fase 3 — Nova orientação: EVACUAR',
      body: 'A Defesa Civil agora orienta todos os moradores da rua a saírem pela rota de fuga até o ponto de encontro.',
      buttons: [{ label: 'Continuar' }],
    });
    const qp = await ui.ask(run, {
      title: 'Antes de sair',
      body: 'Como proteger a respiração no caminho?',
      columns: 1,
      buttons: [
        { label: 'Prender a respiração e correr', value: 'prender' },
        { label: 'Cobrir o nariz e a boca com um pano úmido', value: 'pano' },
        { label: 'Não precisa: é só um cheiro forte', value: 'nada' },
      ],
    });
    record(fase, 'Cobriu nariz e boca com pano úmido', qp === 'pano');
    await ui.ask(run, {
      tone: qp === 'pano' ? 'success' : 'warning',
      title: qp === 'pano' ? 'Isso!' : 'Use um pano úmido',
      body: 'Cubra o nariz e a boca com um pano úmido e caminhe sem correr. O pano não filtra tudo, mas reduz o que você respira até sair da área.',
      buttons: [{ label: 'Sair de casa' }],
    });

    ui.setHud(['FASE 3 — EVACUAÇÃO', 'Escolha o caminho até o ponto de encontro'], 'danger');
    const unhookCloud = inCloudHook();
    let first = null;
    let ok = false;
    while (!ok) {
      const ch = run.deferred();
      const rs = [
        addWaypoint(12.8, -14, 12.8, -25, 'Ir para cá', () => ch.resolve('sentido')),
        addWaypoint(15.2, -1.6, 15.2, -12, 'Ir para cá', () => ch.resolve('caminhao')),
        addWaypoint(12.8, 10.5, 12.8, 20, 'Ir para cá', () => ch.resolve('rota')),
      ];
      const c = await ch.promise;
      rs.forEach((r) => r());
      if (first === null) first = c;
      if (c === 'rota') ok = true;
      else {
        sfx.bad();
        await run.wait(1.2);
        await ui.ask(run, {
          tone: 'danger',
          title: c === 'sentido' ? 'Esse é o caminho da nuvem!' : 'Não passe perto do caminhão!',
          body:
            c === 'sentido'
              ? 'Nunca saia no mesmo sentido em que a nuvem vai. Siga a rota indicada pela Defesa Civil, para o lado oposto ou de lado em relação ao vento.'
              : 'Cortar caminho perto do vazamento é muito perigoso, mesmo que pareça mais curto. Siga a rota de fuga sinalizada.',
          buttons: [{ label: 'Voltar' }],
        });
        await goTo(8.6, 1.4, 12.3, 4.6);
      }
    }
    unhookCloud();
    g.setSmokeOverlay(0);
    record(fase, 'Seguiu a rota de fuga (longe da nuvem)', first === 'rota', 2);
    await ui.ask(run, {
      tone: 'success',
      title: 'Você chegou ao ponto de encontro!',
      body: 'Informe à equipe da Defesa Civil que você saiu e se alguém da sua casa ou da vizinhança ficou para trás.',
      buttons: [{ label: 'Continuar' }],
    });
    ui.setHud([]);
  };

  // ---------------------------------------------------------------- FASE 4 — Depois do vazamento
  const fase4 = async () => {
    const fase = 'Depois do vazamento';
    await g.fade(1, 0.5);
    startCloud(0.35);
    C.cordon.visible = true;
    sfx.setSiren(false);
    sfx.setSpray(false);
    pose(12.8, 10.5, TRUCK[0], TRUCK[1]);
    await g.fade(0, 0.6);
    ui.setHud(['FASE 4 — DEPOIS DO VAZAMENTO']);
    const q1 = await ui.ask(run, {
      title: 'Olhos ardendo',
      body: 'No ponto de encontro, seus olhos ardem e você está tossindo. O que fazer?',
      columns: 1,
      buttons: [
        { label: 'Esfregar os olhos e esperar passar', value: 'esfregar' },
        { label: 'Lavar com bastante água corrente e procurar atendimento', value: 'lavar' },
      ],
    });
    record(fase, 'Lavou os olhos e procurou atendimento', q1 === 'lavar', 2);
    await ui.ask(run, {
      tone: q1 === 'lavar' ? 'success' : 'danger',
      title: q1 === 'lavar' ? 'Correto!' : 'Não esfregue os olhos!',
      body: 'Lave os olhos e a pele com bastante água corrente por cerca de 15 minutos, sem esfregar. Procure atendimento médico e diga qual foi o produto (aqui, amônia). Avise a equipe de socorro sobre os sintomas.',
      buttons: [{ label: 'Continuar' }],
    });

    const q2 = await ui.ask(run, {
      title: 'Voltar para casa',
      body: 'Quando é seguro voltar para casa?',
      columns: 1,
      buttons: [
        { label: 'Quando eu não sentir mais o cheiro', value: 'cheiro' },
        { label: 'Quando a Defesa Civil liberar a área', value: 'liberar' },
      ],
    });
    record(fase, 'Só voltou com a liberação da Defesa Civil', q2 === 'liberar', 2);
    await ui.ask(run, {
      tone: q2 === 'liberar' ? 'success' : 'warning',
      title: q2 === 'liberar' ? 'Isso mesmo!' : 'Sem cheiro não quer dizer seguro',
      body: 'Alguns produtos não têm cheiro, e o nariz se acostuma rápido com outros. Volte só quando a Defesa Civil liberar e, ao chegar, abra portas e janelas para ventilar a casa.',
      buttons: [{ label: 'Continuar' }],
    });

    const q3 = await ui.ask(run, {
      title: 'Ficar informado',
      body: 'Como acompanhar as orientações oficiais numa emergência química?',
      columns: 1,
      buttons: [
        { label: 'Pelos alertas da Defesa Civil (SMS 40199), sirenes, rádio e TV', value: 'oficial' },
        { label: 'Pelas mensagens que chegam nos grupos de conversa', value: 'grupos' },
      ],
    });
    record(fase, 'Segue as orientações oficiais', q3 === 'oficial');
    await ui.ask(run, {
      tone: q3 === 'oficial' ? 'success' : 'warning',
      title: q3 === 'oficial' ? 'Correto!' : 'Cuidado com boatos',
      body: 'Nas emergências circulam muitos boatos. Siga só as orientações oficiais: alertas da Defesa Civil (cadastre o CEP no SMS 40199), sirenes, rádio e TV. Em caso de dúvida, ligue 199.',
      buttons: [{ label: 'Ver resultado' }],
    });
  };

  // ---------------------------------------------------------------- Execução
  const fases = [fase1, fase2, fase3, fase4];
  const inicio = clamp(opts.startPhase || 1, 1, fases.length);
  for (const f of fases.slice(inicio - 1)) await f();
  await showResults(g, run, results, [
    'Excelente! Você sabe se proteger num vazamento químico.',
    'Bom trabalho! Revise os pontos abaixo.',
    'Atenção! Num vazamento químico, segundos de exposição fazem diferença.',
    'Vamos treinar mais? Afastar-se, abrigar-se e seguir as orientações salva vidas.',
  ]);
}
