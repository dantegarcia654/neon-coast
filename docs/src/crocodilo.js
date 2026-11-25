import * as T from "three";

export const crocName = "Bombardiro Crocodilo";
const paint = (color, metalness = 0.1) =>
  new T.MeshStandardMaterial({ color, metalness, roughness: 0.49 });
const hide = paint("#617540"),
  ridges = paint("#304127"),
  belly = paint("#b9ad78");
const alloy = paint("#89918e", 0.8),
  dark = paint("#364349", 0.65),
  yellow = paint("#ebae37");
const teeth = paint("#fff4ce"),
  eyes = paint("#111614"),
  glass = paint("#80c1c2", 0.55);
const sphere = new T.SphereGeometry(1, 16, 10),
  box = new T.BoxGeometry(1, 1, 1);
const tooth = new T.ConeGeometry(1, 1, 5);
function part(parent, geo, mat, x, y, z, w, h, d) {
  const mesh = new T.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  parent.add(mesh);
  return mesh;
}
function airframe() {
  const g = new T.Group();
  part(g, sphere, alloy, 0, 0.04, 0.05, 0.14, 0.14, 0.48);
  part(g, sphere, glass, 0, 0.145, -0.015, 0.1, 0.067, 0.13);
  part(g, sphere, hide, 0, 0.06, -0.29, 0.155, 0.12, 0.21);
  part(g, sphere, belly, 0, -0.012, -0.47, 0.129, 0.044, 0.22);
  part(g, sphere, eyes, 0, 0.021, -0.47, 0.122, 0.023, 0.209);
  part(g, sphere, hide, 0, 0.074, -0.49, 0.131, 0.051, 0.218);
  for (const side of [-1, 1]) {
    part(g, sphere, ridges, side * 0.075, 0.109, -0.633, 0.021, 0.012, 0.032);
    part(g, sphere, yellow, side * 0.121, 0.137, -0.32, 0.037, 0.041, 0.047);
    part(g, sphere, eyes, side * 0.15, 0.139, -0.337, 0.011, 0.023, 0.017);
    for (let n = 0; n < 5; n++) {
      const z = -0.39 - n * 0.055;
      part(
        g,
        tooth,
        teeth,
        side * (0.122 - 0.006 * n),
        0.024,
        z,
        0.014,
        0.048,
        0.014,
      ).rotation.z = Math.PI;
    }
    const wing = part(
      g,
      sphere,
      alloy,
      side * 0.29,
      0.035,
      0.1,
      0.37,
      0.028,
      0.14,
    );
    wing.rotation.y = -side * 0.16;
    part(g, sphere, yellow, side * 0.58, 0.038, 0.145, 0.046, 0.023, 0.069);
    part(g, sphere, dark, side * 0.31, 0.025, 0.025, 0.056, 0.059, 0.115);
    const prop = new T.Group();
    prop.name = "propeller";
    prop.position.set(side * 0.31, 0.025, -0.09);
    g.add(prop);
    for (let n = 0; n < 3; n++) {
      const blade = new T.Group();
      blade.rotation.z = (n * 2 * Math.PI) / 3;
      prop.add(blade);
      part(blade, sphere, dark, 0, 0.064, 0, 0.018, 0.074, 0.009);
      part(blade, sphere, yellow, 0, 0.12, 0, 0.014, 0.018, 0.01);
    }
    part(
      g,
      sphere,
      alloy,
      side * 0.15,
      0.079,
      0.43,
      0.19,
      0.018,
      0.07,
    ).rotation.y = -side * 0.22;
  }
  part(g, sphere, hide, 0, 0.07, 0.45, 0.065, 0.065, 0.13);
  part(g, sphere, ridges, 0, 0.145, 0.43, 0.023, 0.131, 0.074).rotation.x =
    0.34;
  return g;
}
export function crocLauncher() {
  const model = airframe(),
    ammo = airframe(),
    load = new T.Group();
  model.userData.portraitView = [1.65, 1.35, -1.55];
  // The folded cradle and shoulder pad distinguish the held toy from the free-flying character.
  part(model, box, dark, 0, -0.081, 0.045, 0.17, 0.09, 0.58);
  part(model, box, belly, 0, -0.148, 0.09, 0.082, 0.17, 0.105).rotation.x =
    -0.18;
  part(model, sphere, dark, 0, -0.07, 0.39, 0.127, 0.13, 0.13);
  part(load, sphere, yellow, 0, 0.15, 0.19, 0.05, 0.018, 0.085);
  model.add(load);
  ammo.scale.setScalar(0.85);
  return { model, ammo, load, mouth: new T.Vector3(0, 0.055, -0.73) };
}
export function spinProps(group, time) {
  group.traverse((p) => {
    if (p.name === "propeller") p.rotation.z = time * 32;
  });
}
