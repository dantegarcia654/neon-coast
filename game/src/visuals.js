import {buildLanding,pierHeight,atPier,atTerminal,coastWater} from './transport.js';
import * as THREE from "three";
import {createRuralWorld} from './terrain.js';
import {installVehicleModels} from "./vehicles.js";
import {createCharacterSystem} from "./characters.js";
import {buildDistrictLandmarks,groundHeight,waterWalkway,districtAt,MAP_FEATURES} from "./districts.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function createWorld(canvas) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#c6aba0", 0.0025);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const camera = new THREE.PerspectiveCamera(
    57,
    innerWidth / innerHeight,
    0.1,
    2200,
  );
  const sun = new THREE.DirectionalLight("#ffd0a1", 3.1);
  sun.position.set(-60, 85, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -65,
    right: 65,
    top: 65,
    bottom: -65,
    near: 1,
    far: 300,
  });
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0001;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight("#9fbfd9", "#65524b", 1.15));
  const skyGeo = new THREE.SphereGeometry(1250, 48, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color("#517fa9") },
      horizon: { value: new THREE.Color("#f6bea0") },
      bottom: { value: new THREE.Color("#d7c4b1") },
    },
    vertexShader:
      "varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader:
      "varying vec3 v;uniform vec3 top;uniform vec3 horizon;uniform vec3 bottom;void main(){float h=normalize(v).y;vec3 c=mix(horizon,top,pow(max(h,0.),.45));c=mix(c,bottom,smoothstep(0.,-.25,h));gl_FragColor=vec4(c,1.);}",
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(15, 24, 16),
    new THREE.MeshBasicMaterial({ color: "#ffdbaf" }),
  );
  sunDisk.position.set(-360, 92, -400);
  scene.add(sunDisk);
  const texLoader = new THREE.TextureLoader();
  let loaded = 0;
  const texture = (url, srgb = true) => {
    const t = texLoader.load("./assets/" + url, () => loaded++);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const asphalt = texture("asphalt.jpg"),
    asphaltN = texture("asphalt-normal.jpg", false),
    asphaltR = texture("asphalt-rough.jpg", false),
    plaster = texture("plaster.jpg"),
    plasterN = texture("plaster-normal.jpg", false);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environmentReady = false;
  new HDRLoader().load("./assets/sunset.hdr", (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.8;
    hdr.dispose();
    pmrem.dispose();
    environmentReady = true;
  });
  let randomSeed = 88;
  const rand = () => {
    randomSeed = (randomSeed * 16807) % 2147483647;
    return (randomSeed - 1) / 2147483646;
  };
  const cache = new Map();
  const material = (color, kind = "solid") => {
    const key = color + kind;
    if (cache.has(key)) return cache.get(key);
    let options = { color, roughness: 0.76 };
    if (kind === "plaster")
      Object.assign(options, {
        map: plaster,
        normalMap: plasterN,
        normalScale: new THREE.Vector2(0.32, 0.32),
      });
    if (kind === "road")
      Object.assign(options, {
        map: asphalt,
        normalMap: asphaltN,
        roughnessMap: asphaltR,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.86,
      });
    if (kind === "glass")
      Object.assign(options, {
        metalness: 0.65,
        roughness: 0.12,
        envMapIntensity: 1.3,
      });
    if (kind === "metal")
      Object.assign(options, { metalness: 0.8, roughness: 0.3 });
    if (kind === "paint")
      return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.62,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.16,
        envMapIntensity: 1.6,
      });
    const m = new THREE.MeshStandardMaterial(options);
    cache.set(key, m);
    return m;
  };
  const staticMeshes = [];
  function mesh(
    geometry,
    m,
    x = 0,
    y = 0,
    z = 0,
    parent = scene,
    isStatic = true,
  ) {
    const o = new THREE.Mesh(geometry, typeof m === "string" ? material(m) : m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    if (isStatic) staticMeshes.push(o);
    return o;
  }
  function box(
    w,
    h,
    d,
    c,
    x = 0,
    y = 0,
    z = 0,
    parent = scene,
    kind = "solid",
    isStatic = true,
  ) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (kind === "road" || kind === "plaster") {
      const uv = geo.attributes.uv;
      const scales = [
        [d, h],
        [d, h],
        [w, d],
        [w, d],
        [w, h],
        [w, h],
      ];
      for (let i = 0; i < uv.count; i++) {
        const s = scales[Math.floor(i / 4)];
        uv.setXY(i, (uv.getX(i) * s[0]) / 5, (uv.getY(i) * s[1]) / 5);
      }
    }
    return mesh(geo, material(c, kind), x, y, z, parent, isStatic);
  }
  function cylinder(
    rt,
    rb,
    h,
    c,
    x,
    y,
    z,
    parent = scene,
    n = 12,
    isStatic = true,
  ) {
    return mesh(
      new THREE.CylinderGeometry(rt, rb, h, n),
      material(c),
      x,
      y,
      z,
      parent,
      isStatic,
    );
  }
  function roundBox(w, h, d, m, x, y, z, parent, isStatic = false, r = 0.09) {
    return mesh(
      new RoundedBoxGeometry(w, h, d, 2, r),
      m,
      x,
      y,
      z,
      parent,
      isStatic,
    );
  }
  const roads = [-144, -96, -48, 0, 48, 96, 144],
    colliders = [],
    buildings = [];
  box(355, 1, 355, "#a99c86", 0, -0.6, 0);
  box(40, 0.3, 360, "#d8c3a2", 194, -0.3, 0);
  for (const n of roads) {
    box(18, 0.12, 355, "#777a7c", n, 0, 0, scene, "road");
    box(355, 0.12, 18, "#777a7c", 0, 0.015, n, scene, "road");
    for (let v = -170; v < 173; v += 10) {
      if (roads.every((k) => Math.abs(v - k) > 11)) {
        box(0.14, 0.012, 4, "#d2bd85", n - 0.22, 0.09, v);
        box(0.14, 0.012, 4, "#d2bd85", n + 0.22, 0.09, v);
        box(4, 0.012, 0.14, "#d2bd85", v, 0.1, n - 0.22);
        box(4, 0.012, 0.14, "#d2bd85", v, 0.1, n + 0.22);
      }
    }
  }
  // Sidewalk islands leave every junction and lane open.
  function label(text, color, w, h) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#142b32";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, 1008, 240);
    ctx.fillStyle = color;
    ctx.font = "bold 100px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 512, 166);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        map: t,
        emissive: color,
        emissiveMap: t,
        emissiveIntensity: 0.25,
        roughness: 0.45,
      }),
    );
  }
  const palette = [
    "#e7ccad",
    "#d7b0a4",
    "#b2c9c0",
    "#d3d0b6",
    "#c7b4a4",
    "#a2b9c0",
  ];
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++) {
      const x = -120 + i * 48,
        z = -120 + j * 48;
      // The marina cell is open water; omit the old sidewalk slab and curbs.
      if (i === 5 && j === 1) continue;
      box(30, 0.32, 30, "#b7b0a1", x, 0.12, z, scene, "plaster");
      box(30.35, 0.15, 0.2, "#e1d5bf", x, 0.21, z + 15.08);
      box(0.2, 0.15, 30.35, "#e1d5bf", x + 15.08, 0.21, z);
      if ((i === 4 && j === 1) || (i === 3 && j === 3)) continue;
      if (i === 5 && j === 2) {
        box(26, 0.2, 26, "#667d52", x, 0.35, z);
        for (let b = -9; b <= 9; b += 9) {
          box(6, 0.4, 2, "#b8a18a", x + b, 0.5, z);
          for (let a = -2; a < 3; a += 2)
            cylinder(1.3, 1.4, 1.4, "#58734e", x + b + a, 1, z);
        }
        continue;
      }
      const residential=j>=4,industrial=i<=1&&!residential;
      const h = residential?5+rand()*4:industrial?8+rand()*5:18+rand()*35,
        w = residential?13+rand()*4:industrial?25:19+rand()*7,
        d = residential?14+rand()*4:industrial?25:19+rand()*7,
        col = palette[Math.floor(rand() * palette.length)];
      box(w, h, d, col, x, h / 2 + 0.3, z, scene, "plaster");
      box(w + 0.6, 0.35, d + 0.6, "#ead9c0", x, h + 0.4, z);
      box(w + 0.7, 0.28, d + 0.7, "#b3a18e", x, 3.15, z);
      box(w + 0.6, 0.2, d + 0.6, "#d6cbb7", x, 1, z);
      colliders.push({ x, z, w: w / 2 + 0.6, d: d / 2 + 0.6 });
      buildings.push({ x, z, w, d, h });
      for (let y = 5; y < h - 1; y += 3.4) {
        if ((i + j) % 3 === 0)
          box(w + 0.18, 0.13, d + 0.18, "#b29f8a", x, y - 1.35, z);
        for (let q = -w / 2 + 2; q < w / 2 - 1; q += 3.8) {
          for (const side of [-1, 1]) {
            box(
              1.95,
              2.25,
              0.13,
              "#deceba",
              x + q,
              y,
              z + side * (d / 2 + 0.08),
            );
            box(
              1.65,
              1.92,
              0.08,
              Math.floor(q + y + i) % 4 === 0 ? "#bea47c" : "#29444c",
              x + q,
              y,
              z + side * (d / 2 + 0.16),
              scene,
              "glass",
            );
            box(
              0.05,
              1.92,
              0.1,
              "#a4aca4",
              x + q,
              y,
              z + side * (d / 2 + 0.22),
            );
            if (j % 2 === 0 && side === 1) {
              box(2.8, 0.15, 1.1, "#c3b09d", x + q, y - 1.15, z + d / 2 + 0.55);
              box(
                2.7,
                0.07,
                0.07,
                "#34434a",
                x + q,
                y - 0.45,
                z + d / 2 + 1.05,
              );
              for (const dx of [-1.25, 0, 1.25])
                box(
                  0.045,
                  0.7,
                  0.045,
                  "#34434a",
                  x + q + dx,
                  y - 0.8,
                  z + d / 2 + 1.05,
                );
            }
          }
        }
        for (let q = -d / 2 + 2; q < d / 2 - 1; q += 3.8) {
          box(0.13, 2.2, 1.95, "#d6c6b2", x + w / 2 + 0.08, y, z + q);
          box(
            0.08,
            1.9,
            1.65,
            "#344f58",
            x + w / 2 + 0.16,
            y,
            z + q,
            scene,
            "glass",
          );
        }
      }
      // Ground-floor glass, door frames, awnings and roof equipment.
      for (let q = -w / 2 + 2; q < w / 2 - 1; q += 4) {
        box(
          3,
          2.2,
          0.12,
          "#25424a",
          x + q,
          1.65,
          z + d / 2 + 0.15,
          scene,
          "glass",
        );
        box(0.09, 2.4, 0.15, "#9faaa1", x + q - 1.5, 1.65, z + d / 2 + 0.3);
      }
      if (h < 25 && !residential && !industrial) {
        const s = label(
          [
            "OCEAN CLUB",
            "PALM HOTEL",
            "SUNDOWN",
            "THE MARLIN",
            "VICE MARKET",
            "PARADISE",
          ][(i + j) % 6],
          i % 2 ? "#89dfca" : "#f3a9ac",
          w * 0.78,
          1.65,
        );
        s.position.set(x, 3.95, z + d / 2 + 0.35);
        scene.add(s);
        staticMeshes.push(s);
        const a = box(
          w * 0.9,
          0.18,
          1.6,
          i % 2 ? "#4f7b78" : "#ac756b",
          x,
          2.9,
          z + d / 2 + 0.65,
        );
        a.rotation.x = 0.12;
      }
      for (let r = 0; r < 3; r++) {
        box(2, 0.8, 2.3, "#9c9b91", x - w / 3 + (r * w) / 3, h + 1, z);
        for (let l = 0; l < 4; l++)
          box(
            1.7,
            0.035,
            0.12,
            "#48545b",
            x - w / 3 + (r * w) / 3,
            h + 1.42,
            z - 0.7 + l * 0.4,
          );
      }
    }
  // Curved palm fronds, with cut leaflets and a tapered trunk.
  function palm(x, z, size = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(size);
    scene.add(g);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.2, 3, 0),
      new THREE.Vector3(0.65, 6, 0.1),
      new THREE.Vector3(0.4, 9, 0.15),
    ]);
    mesh(
      new THREE.TubeGeometry(curve, 12, 0.18, 7, false),
      material("#8b7861"),
      0,
      0,
      0,
      g,
    );
    for (let r = 0.6; r < 8.8; r += 0.44) {
      const t = r / 9,
        pt = curve.getPoint(t);
      const ring = mesh(
        new THREE.TorusGeometry(0.185, 0.023, 3, 8),
        material("#685e4b"),
        pt.x,
        pt.y,
        pt.z,
        g,
      );
      ring.rotation.x = Math.PI / 2;
    }
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI * 2) / 10 + rand() * 0.2;
      const frond = new THREE.Group();
      frond.position.set(0.4, 9, 0.15);
      frond.rotation.y = a;
      g.add(frond);
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.7, 1.5),
        new THREE.Vector3(0, 0.25, 3.2),
        new THREE.Vector3(0, -1.5, 4.7),
      ];
      const path = new THREE.CatmullRomCurve3(points);
      mesh(
        new THREE.TubeGeometry(path, 10, 0.028, 4, false),
        material("#69804b"),
        0,
        0,
        0,
        frond,
      );
      const positions = [],
        uvs = [],
        indices = [];
      for (let t = 0; t <= 16; t++) {
        const f = t / 16,
          pt = path.getPoint(f),
          width = Math.sin(f * Math.PI) * 0.6;
        positions.push(
          -width,
          pt.y,
          pt.z,
          0,
          pt.y + 0.08,
          pt.z,
          width,
          pt.y,
          pt.z,
        );
        uvs.push(0, f, 0.5, f, 1, f);
        if (t < 16) {
          const n = t * 3;
          indices.push(
            n,
            n + 3,
            n + 1,
            n + 1,
            n + 3,
            n + 4,
            n + 1,
            n + 4,
            n + 2,
            n + 2,
            n + 4,
            n + 5,
          );
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const leafMat = material(k % 2 ? "#487143" : "#65884b");
      leafMat.side = THREE.DoubleSide;
      mesh(geo, leafMat, 0, 0, 0, frond);
      for (let t = 2; t < 15; t++) {
        const f = t / 16,
          pt = path.getPoint(f);
        for (const side of [-1, 1]) {
          const stem = new THREE.CatmullRomCurve3([
            pt.clone(),
            new THREE.Vector3(
              side * Math.sin(f * Math.PI) * 0.8,
              pt.y - 0.08,
              pt.z + 0.18,
            ),
          ]);
          mesh(
            new THREE.TubeGeometry(stem, 1, 0.025, 3, false),
            material("#52723e"),
            0,
            0,
            0,
            frond,
          );
        }
      }
    }
  }
  for (let z = -164; z < 175; z += 20) palm(171, z, 1 + rand() * 0.25);
  for (let x = -156; x < 168; x += 24) {
    if (roads.every((n) => Math.abs(n - x) > 10)) {
      palm(x, 12, 1);
      palm(x, -12, 0.85);
    }
  }
  // Promenade, lamps, benches, fire hydrants and crossing signals.
  box(7, 0.25, 355, "#c1aa8d", 165, 0, 0, scene, "plaster");
  for (let z = -160; z < 170; z += 24) {
    cylinder(0.08, 0.13, 7, "#3c494e", 157, 3.5, z);
    const arm = box(2.1, 0.1, 0.1, "#3c494e", 156, 6.9, z);
    box(1.7, 0.08, 0.55, "#ecdfaa", 155.4, 6.85, z);
    for (let k = 0; k < 4; k++)
      box(0.14, 0.06, 2, "#8c7760", 163 + k * 0.2, 0.7, z);
    for (const a of [-0.7, 0.7])
      box(0.6, 0.65, 0.12, "#394349", 163.4, 0.4, z + a);
    cylinder(0.3, 0.32, 0.6, "#4a6261", 162, 0.5, z + 6);
  }
  for (const x of roads)
    for (const z of roads) {
      if (Math.abs(x) > 145 || Math.abs(z) > 145) continue;
      for (let q = -5; q <= 5; q += 2) {
        box(1.15, 0.018, 2.5, "#c9c6b4", x + q, 0.12, z + 10.7);
        box(2.5, 0.018, 1.15, "#c9c6b4", x + 10.7, 0.12, z + q);
      }
      cylinder(0.08, 0.1, 4.6, "#485257", x + 10, 2.3, z - 10);
      box(0.32, 0.85, 0.28, "#333c40", x + 10, 4.25, z - 10);
      mesh(
        new THREE.SphereGeometry(0.095, 8, 6),
        new THREE.MeshStandardMaterial({
          color: "#ff715b",
          emissive: "#ff3314",
          emissiveIntensity: 1.8,
        }),
        x + 10,
        4.5,
        z - 9.83,
      );
      cylinder(0.12, 0.19, 0.7, "#aa5546", x - 11, 0.5, z + 12);
    }
  // Large horizon ocean with animated world-space wave normals.
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: "#547f82",
    metalness: 0.35,
    roughness: 0.24,
    transparent: true,
    opacity: 0.94,
    envMapIntensity: 1.5,
  });
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    waterMaterial.userData.shader = shader;
    shader.vertexShader =
      "uniform float uTime; varying vec3 vWorld;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvWorld=(modelMatrix*vec4(position,1.)).xyz; transformed.z+=sin(vWorld.x*.19+vWorld.z*.07+uTime*.8)*.045+sin(vWorld.z*.27-uTime*.6)*.028;",
    );
    shader.fragmentShader =
      "uniform float uTime;varying vec3 vWorld;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      "#include <normal_fragment_begin>\nfloat fade=1./(1.+.018*distance(cameraPosition,vWorld)); vec2 chop=vec2(sin(vWorld.x*.43+vWorld.z*.31+uTime)+.5*sin(vWorld.z*.76-uTime),cos(vWorld.z*.37-vWorld.x*.24-uTime)+.4*cos(vWorld.x*.9+uTime)); normal=normalize(normal+mat3(viewMatrix)*vec3(chop.x,0.,chop.y)*.078*fade);",
    );
  };
  const water = mesh(
    new THREE.PlaneGeometry(2048, 2048, 100, 100),
    waterMaterial,
    0,
    -0.9,
    0,
    scene,
    false,
  );
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = false;
  water.castShadow = false;
  // Beach umbrellas and distant skyline give the coast a sense of scale.
  for (let z = -155; z < 170; z += 26) {
    cylinder(0.035, 0.035, 2.4, "#b8a186", 190, 1, z);
    const u = mesh(
      new THREE.ConeGeometry(2.2, 0.6, 12),
      material(z % 3 ? "#c6b392" : "#6f9a98"),
      190,
      2.5,
      z,
    );
    box(1, 0.15, 2.2, "#ece0c9", 193, 0.15, z);
  }
  for (let n = 0; n < 32; n++) {
    const x = -410 + n * 17,
      h = 25 + rand() * 95;
    box(12, h, 14, "#9daba8", x, h / 2, 315, scene, "plaster");
  }
  const cameraObstacles=[];
  createRuralWorld(scene,material("#797875","road"),box,label,colliders,cameraObstacles);
  buildDistrictLandmarks({scene,box,mesh,material,cylinder,waterMaterial,colliders,buildings,label,palm});
  // Batch scenery without baking dynamic actors.
  scene.updateMatrixWorld(true);
  buildLanding(scene);scene.updateMatrixWorld(true);
  const shotSurfaces=[];
  scene.traverse(o=>{if(o.isMesh&&o!==sunDisk&&o.material!==skyMat)shotSurfaces.push(o)});
  const batches = new Map();
  for (const o of staticMeshes) {
    if (!o.parent) continue;
    const list = batches.get(o.material) || [];
    list.push(o);
    batches.set(o.material, list);
  }
  const occluders = [];
  for (const [m, objects] of batches) {
    const gs = objects.map((o) =>
      o.geometry.clone().applyMatrix4(o.matrixWorld).toNonIndexed(),
    );
    const geometry = mergeGeometries(gs);
    if (geometry) {
      const o = new THREE.Mesh(geometry, m);
      o.castShadow = true;
      o.receiveShadow = true;
      scene.add(o);
      occluders.push(o);
      objects.forEach((o) => o.removeFromParent());
    }
    gs.forEach((g) => g.dispose());
  }
  // Sculpted original sports coupe with clear-coated paint, glass, trim and wheels.
  function quad(points, m, parent) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points.flat(), 3),
    );
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
    g.computeVertexNormals();
    return mesh(g, m, 0, 0, 0, parent, false);
  }
  function makeCar(x, z, color, police = false, axis = 0) {
    const g = new THREE.Group(),
      paint = material(color, "paint"),
      dark = material("#151c22", "glass"),
      chrome = material("#bdc4c2", "metal"),
      black = material("#171a1b");
    const profile = new THREE.Shape();
    profile.moveTo(-2.17,.46); profile.lineTo(-2.17,.78);
    profile.quadraticCurveTo(-1.9,.98,-1.3,1.0); profile.lineTo(1.3,1.0);
    profile.quadraticCurveTo(2.08,.95,2.17,.79); profile.lineTo(2.17,.46);
    profile.lineTo(1.78,.42); profile.absarc(1.35,.42,.43,0,Math.PI,false);
    profile.lineTo(-.92,.42); profile.absarc(-1.35,.42,.43,0,Math.PI,false);
    profile.lineTo(-2.17,.46);
    const shell = new THREE.ExtrudeGeometry(profile,{depth:1.96,bevelEnabled:true,bevelThickness:.055,bevelSize:.065,bevelSegments:3,curveSegments:12,steps:1});
    shell.rotateY(-Math.PI/2); shell.translate(.98,0,0);
    mesh(shell,paint,0,0,0,g,false);
    roundBox(1.95, 0.12, 1.2, paint, 0, 0.99, -1.42, g);
    roundBox(1.93, 0.15, 0.6, paint, 0, 0.97, 1.63, g);
    // Glass cabin is a sloped six-sided solid, framed by narrow metal pillars.
    const lf = [-0.84, 1.03, -0.98],
      rf = [0.84, 1.03, -0.98],
      ltf = [-0.69, 1.43, -0.38],
      rtf = [0.69, 1.43, -0.38],
      ltr = [-0.7, 1.41, 0.67],
      rtr = [0.7, 1.41, 0.67],
      lr = [-0.88, 1.02, 1.25],
      rr = [0.88, 1.02, 1.25];
    dark.side = THREE.DoubleSide;
    quad([lf, rf, rtf, ltf], dark, g);
    quad([lr, ltr, rtr, rr], dark, g);
    quad([lf, ltf, ltr, lr], dark, g);
    quad([rf, rr, rtr, rtf], dark, g);
    roundBox(1.47, 0.11, 1.12, paint, 0, 1.46, 0.15, g);
    function bar(a, b, r, m) {
      const av = new THREE.Vector3(...a),
        bv = new THREE.Vector3(...b),
        d = bv.clone().sub(av);
      const o = mesh(
        new THREE.CylinderGeometry(r, r, d.length(), 6),
        m,
        ...av.clone().add(bv).multiplyScalar(0.5).toArray(),
        g,
        false,
      );
      o.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        d.normalize(),
      );
    }
    for (const [a, b] of [
      [lf, ltf],
      [rf, rtf],
      [lr, ltr],
      [rr, rtr],
    ])
      bar(a, b, 0.035, paint);
    for (const s of [-1, 1]) {
      bar([s * 0.86, 1.04, 0.32], [s * 0.7, 1.42, 0.32], 0.034, paint);
      roundBox(0.25, 0.12, 0.38, paint, s * 1.03, 1.12, -0.55, g);
      roundBox(0.21, 0.04, 0.06, chrome, s * 1.085, 1.01, 0.65, g);
      box(0.04, 0.05, 2.45, "#25292c", s * 1.09, 0.59, 0, g, "solid", false);
      box(0.02, 0.028, 1, "#161c20", s * 1.087, 0.9, 0.35, g, "solid", false);
    }
    roundBox(1.7, 0.18, 0.16, black, 0, 0.53, -2.25, g);
    for (const s of [-1, 1]) {
      roundBox(
        0.54,
        0.1,
        0.1,
        new THREE.MeshStandardMaterial({
          color: "#fff2d2",
          emissive: "#ffe2a1",
          emissiveIntensity: 0.75,
        }),
        s * 0.66,
        0.8,
        -2.25,
        g,
      );
      roundBox(
        0.57,
        0.09,
        0.1,
        new THREE.MeshStandardMaterial({
          color: "#9f1c16",
          emissive: "#e32c21",
          emissiveIntensity: 0.55,
        }),
        s * 0.65,
        0.82,
        2.25,
        g,
      );
      roundBox(0.3, 0.075, 0.15, chrome, s * 0.7, 0.42, 2.25, g);
    }
    roundBox(0.55, 0.18, 0.035, material("#ddd5bd"), 0, 0.58, 2.25, g);
    const wheels = [];
    for (const s of [-1, 1])
      for (const z of [-1.35, 1.35]) {
        const wheel = new THREE.Group();
        wheel.position.set(s * 1.0, 0.4, z);
        g.add(wheel);
        const tire = mesh(
          new THREE.TorusGeometry(0.25, 0.105, 8, 18),
          black,
          0,
          0,
          0,
          wheel,
          false,
        );
        tire.rotation.y = Math.PI / 2;
        const rim = mesh(
          new THREE.CylinderGeometry(0.23, 0.23, 0.16, 16),
          chrome,
          s * 0.09,
          0,
          0,
          wheel,
          false,
        );
        rim.rotation.z = Math.PI / 2;
        for (let a = 0; a < 5; a++) {
          const spoke = box(
            0.025,
            0.39,
            0.045,
            "#333b40",
            s * 0.19,
            0,
            0,
            wheel,
            "metal",
            false,
          );
          spoke.rotation.x = (a * Math.PI) / 5;
        }
        wheels.push(wheel);
      }
    let light;
    if (police) {
      roundBox(1.75, 0.04, 0.7, material("#e4e9e7"), 0, 1.52, 0.15, g);
      light = roundBox(1.4, 0.13, 0.32, material("#438eff"), 0, 1.63, 0.15, g);
      for (const s of [-1, 1])
        box(
          0.02,
          0.31,
          1.5,
          "#e6ebe8",
          s * 1.075,
          0.8,
          0.25,
          g,
          "solid",
          false,
        );
    }
    g.position.set(x, 0, z);
    g.rotation.y = axis;
    scene.add(g);
    return {
      g,
      x,
      z,
      a: axis,
      speed: 0,
      police,
      light,
      health: 100,
      traffic: false,
      wheels,
    };
  }
  function batchGroup(group, excluded = []) {
    group.updateMatrixWorld(true);
    const groups = new Map();
    for (const child of [...group.children]) {
      if (!child.isMesh || excluded.includes(child)) continue;
      const list = groups.get(child.material) || [];
      list.push(child);
      groups.set(child.material,list);
    }
    for (const [m,objects] of groups) {
      if(objects.length < 2) continue;
      const geometries = objects.map(o => o.geometry.clone().applyMatrix4(o.matrix).toNonIndexed());
      const merged = mergeGeometries(geometries);
      if(merged) {
        const mesh = new THREE.Mesh(merged,m);
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
        objects.forEach(o=>o.removeFromParent());
      }
      geometries.forEach(g=>g.dispose());
    }
  }
  const cars = [],
    colors = ["#9c3d2b", "#346a76", "#b59b58", "#252d39", "#876d78", "#c6c4b5"];
  cars.push(makeCar(5, 9, "#ba6640"));
  for (let i = 0; i < 30; i++) {
    const axis = i % 2 === 0,
      lane = roads[Math.floor(rand() * roads.length)],
      n = -158 + rand() * 310,
      c = makeCar(
        axis ? lane + 4 : n,
        axis ? n : lane + 4,
        colors[i % 6],
        false,
        axis ? 0 : Math.PI / 2,
      );
    c.traffic = i > 7;
    c.speed = c.traffic ? 7 + rand() * 5 : 0;
    cars.push(c);
  }
  const cops = [
    makeCar(-2, -7, "#162433", true),
    makeCar(96, 80, "#162433", true),
    makeCar(-30, 144, "#162433", true),
    ...Array.from({length:4},()=> {
      const reserve=makeCar(0,0,"#162433",true);
      reserve.active=reserve.g.visible=false;
      return reserve;
    }),
  ];
  for(const c of [...cars,...cops]){batchGroup(c.g,[c.light]);for(const wheel of c.wheels)batchGroup(wheel)}
  const vehicleModels = installVehicleModels(cars);
 // Jointed human figure, with rounded limbs, face, hair, clothing and shoes.
  function human(shirt = "#d1c6b2", skin = "#a36f50") {
    const root = new THREE.Group();
    const cloth = material(shirt),
      denim = material("#293840"),
      skinMat = material(skin);
    function capsule(r, l, m, x, y, z, parent = root) {
      return mesh(
        new THREE.CapsuleGeometry(r, l, 4, 8),
        m,
        x,
        y,
        z,
        parent,
        false,
      );
    }
    capsule(0.18, 0.3, cloth, 0, 1.2, 0);
    roundBox(0.48, 0.3, 0.33, cloth, 0, 1.37, 0, root);
    capsule(0.12, 0.09, skinMat, 0, 1.62, 0);
    const head = mesh(
      new THREE.SphereGeometry(0.145, 12, 10),
      skinMat,
      0,
      1.85,
      0,
      root,
      false,
    );
    head.scale.set(0.83, 1.17, 0.92);
    const hair = mesh(
      new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
      material("#252320"),
      0,
      1.9,
      0.015,
      root,
      false,
    );
    for (const x of [-0.06, 0.06])
      mesh(
        new THREE.SphereGeometry(0.016, 6, 5),
        material("#242527"),
        x,
        1.87,
        -0.155,
        root,
        false,
      );
    capsule(0.03, 0.045, skinMat, 0, 1.83, -0.17);
    const legs = [],
      arms = [];
    for (const x of [-0.15, 0.15]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.95, 0);
      root.add(pivot);
      capsule(0.105, 0.54, denim, 0, -0.36, 0, pivot);
      roundBox(0.21, 0.14, 0.37, material("#363333"), 0, -0.82, -0.065, pivot);
      legs.push(pivot);
      const arm = new THREE.Group();
      arm.position.set(Math.sign(x) * 0.31, 1.45, 0);
      root.add(arm);
      capsule(0.09, 0.24, cloth, 0, -0.16, 0, arm);
      capsule(0.065, 0.28, skinMat, 0, -0.45, 0, arm);
      capsule(0.072, 0.02, skinMat, 0, -0.65, 0, arm);
      arms.push(arm);
    }
    batchGroup(root);
    return { root, legs, arms };
  }
  const player = human();
  const person = new THREE.Group(),
    legs = player.legs;
  person.add(player.root);
  scene.add(person);
  const characters = createCharacterSystem(person,player.root);
  const pedestrians = [];
  for (let i = 0; i < 18; i++) {
    const humanModel = human(
      ["#7e8a75", "#a49a86", "#87685e", "#52727e"][i % 4],
      ["#a97859", "#c6a081", "#704e3c"][i % 3],
    );
    const x = -125 + (i % 6) * 48,
      z = i < 6 ? 10.5 : i < 12 ? -10.5 : 60;
    humanModel.root.position.set(x, 0, z);
    scene.add(humanModel.root);
    pedestrians.push({
      ...humanModel,
      x,
      z,
      phase: rand() * 6,
      speed: 0.65 + rand() * 0.4,
    });
  }
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth, innerHeight),
    0.17,
    0.65,
    1.3,
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let lastFootX=1,lastFootZ=15;
  function updateVisuals(dt, time, car, p, camera, started) {
    const footSpeed=Math.hypot(p.x-lastFootX,p.z-lastFootZ)/Math.max(dt,.001);lastFootX=p.x;lastFootZ=p.z;
    characters.update(dt,started&&!car?footSpeed:0,!!car,!started);
    const target = car || p;
    const elevation=target.spec?.special?target.y:groundHeight(target.x,target.z);
    scene.fog.density=THREE.MathUtils.damp(scene.fog.density,target.z < -176 ? .0022 : .0025,2,dt);
    sun.target.position.set(target.x, elevation, target.z);
    sun.position.set(target.x - 60, elevation+85, target.z - 60);
    for (const c of [...cars, ...cops]) {
      if(c.spec?.special)continue;
      for (const wheel of c.wheels) wheel.rotation.x -= (c.speed * dt) / 0.45;
      const forwardX=-Math.sin(c.a),forwardZ=-Math.cos(c.a);
      const front=groundHeight(c.x+forwardX*1.45,c.z+forwardZ*1.45);
      const back=groundHeight(c.x-forwardX*1.45,c.z-forwardZ*1.45);
      c.g.rotation.order="YXZ";
      c.g.rotation.x=Math.atan2(front-back,2.9);
      const sideX=Math.cos(c.a)*.8,sideZ=-Math.sin(c.a)*.8;
      c.g.rotation.z=c.z < -176 ? Math.atan2(groundHeight(c.x+sideX,c.z+sideZ)-groundHeight(c.x-sideX,c.z-sideZ),1.6) : 0;
    }
    player.arms[0].rotation.x = -legs[0].rotation.x * 0.75;
    player.arms[1].rotation.x = -legs[1].rotation.x * 0.75;
    for (const npc of pedestrians) {
      npc.startled=Math.max(0,(npc.startled||0)-dt);
      npc.root.rotation.x=-.25*Math.min(1,npc.startled*4);
      npc.root.visible = Math.hypot(npc.x-target.x,npc.z-target.z) < 65;
      npc.root.position.x = npc.x + Math.sin(time * 0.08 + npc.phase) * 8;
      npc.root.position.y = groundHeight(npc.root.position.x,npc.z);
      npc.root.rotation.y =
        Math.cos(time * 0.08 + npc.phase) > 0 ? -Math.PI / 2 : Math.PI / 2;
      npc.legs.forEach(
        (l, i) =>
          (l.rotation.x = Math.sin(time * 3 + npc.phase + i * Math.PI) * 0.25),
      );
      npc.arms.forEach(
        (l, i) =>
          (l.rotation.x = -Math.sin(time * 3 + npc.phase + i * Math.PI) * 0.2),
      );
    }
    if (waterMaterial.userData.shader)
      waterMaterial.userData.shader.uniforms.uTime.value = time;

  }
  function resize() {
    composer.setSize(innerWidth, innerHeight);
  }
  return {
    scene,
    renderer,
    camera,
    roads,
    colliders,
    buildings,
    cameraObstacles,
    shotSurfaces, pedestrians, makeHuman:human,
    cars,
    cops,
    person,
    characters,
    vehicleModels,
    getGroundHeight:(x,z)=>pierHeight(x,z)??groundHeight(x,z),
    isWaterWalkway:waterWalkway,
    districtAt:(x,z)=>atPier(x,z)||atTerminal(x,z)?"EAST PIER":coastWater(x,z)?"ATLANTIC CHANNEL":districtAt(x,z),
    mapFeatures:MAP_FEATURES,
    legs,
    box,
    mat: material,
    rand,
    updateVisuals,
    render: () => {renderer.info.autoReset=false;renderer.info.reset();composer.render();},
    resize,
    visualState: () => ({
      textureCount: loaded,
      environmentReady,
      version: 3,
      triangles: renderer.info.render.triangles,
    }),
  };
}
