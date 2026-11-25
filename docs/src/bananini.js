import * as T from "three";

export const hammerName = "Chimpanzini Bananini";
export const hammerSwing = {
  duration: 0.6,
  contact: 0.24,
  cooldown: 0.79,
  reach: 2.35,
};

function paint(color, metalness = 0.08) {
  return new T.MeshStandardMaterial({ color, metalness, roughness: 0.57 });
}
export function createBananaHammer() {
  // The model origin sits in the palm. The face looks back toward the chase camera.
  const root = new T.Group();
  const green = paint("#457936"),
    moss = paint("#6b9949"),
    skin = paint("#ca9270");
  const lip = paint("#8b5849"),
    eyes = paint("#251f1d"),
    ivory = paint("#fff2c5");
  const yellow = paint("#ffd136"),
    pulp = paint("#ffe895"),
    tip = paint("#835735");
  const grip = paint("#324834"),
    brass = paint("#ca9650", 0.52);
  const ball = new T.SphereGeometry(1, 20, 14);
  function oval(x, y, z, w, h, d, mat) {
    const o = new T.Mesh(ball, mat);
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    root.add(o);
    return o;
  }
  function cylinder(y, length, top, bottom, mat) {
    const m = new T.Mesh(new T.CylinderGeometry(top, bottom, length, 18), mat);
    m.position.y = y;
    root.add(m);
    return m;
  }
  cylinder(0.2, 0.7, 0.046, 0.05, brass);
  cylinder(-0.012, 0.26, 0.059, 0.054, grip);
  for (let i = 0; i < 5; i++)
    cylinder(-0.12 + i * 0.047, 0.014, 0.06, 0.06, moss);
  oval(0, -0.164, 0, 0.067, 0.05, 0.065, brass);
  // Flat-ended striking faces frame the chimp like the barrel of a carnival mallet.
  const barrel = cylinder(0.52, 0.57, 0.143, 0.143, yellow);
  barrel.rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const cap = cylinder(0.52, 0.035, 0.147, 0.147, tip);
    cap.position.x = side * 0.285;
    cap.rotation.z = Math.PI / 2;
    const rim = cylinder(0.52, 0.023, 0.154, 0.154, pulp);
    rim.position.x = side * 0.26;
    rim.rotation.z = Math.PI / 2;
  }
  oval(0, 0.6, 0.015, 0.176, 0.18, 0.145, green);
  for (const side of [-1, 1]) {
    oval(side * 0.168, 0.615, 0.048, 0.072, 0.079, 0.04, moss);
    oval(side * 0.184, 0.615, 0.08, 0.041, 0.05, 0.018, skin);
    oval(side * 0.064, 0.637, 0.129, 0.081, 0.079, 0.043, skin);
    oval(side * 0.062, 0.654, 0.167, 0.033, 0.03, 0.021, ivory);
    oval(side * 0.059, 0.654, 0.185, 0.016, 0.021, 0.011, eyes);
    oval(side * 0.055, 0.66, 0.194, 0.005, 0.006, 0.004, ivory);
    oval(side * 0.062, 0.69, 0.151, 0.067, 0.019, 0.023, green).rotation.z =
      side * 0.12;
  }
  oval(0, 0.568, 0.144, 0.118, 0.074, 0.067, skin);
  oval(0, 0.595, 0.202, 0.052, 0.024, 0.019, lip);
  for (const side of [-1, 1])
    oval(side * 0.021, 0.598, 0.22, 0.01, 0.007, 0.004, eyes);
  oval(0, 0.544, 0.203, 0.051, 0.006, 0.007, lip);
  // Curled banana skin with a pale inside and a raised yellow spine.
  const peelSkin = yellow.clone(),
    peelInside = pulp.clone();
  peelSkin.side = peelInside.side = T.DoubleSide;
  for (const angle of [0.65, 2.45, 3.85, 5.6]) {
    const points = [],
      indices = [];
    const rows = [
      [0.07, 0.48, 0.06],
      [0.15, 0.5, 0.075],
      [0.2, 0.48, 0.069],
      [0.25, 0.41, 0.05],
      [0.27, 0.35, 0.025],
      [0.255, 0.32, 0.003],
    ];
    for (const [r, y, w] of rows)
      for (const side of [-1, 0, 1]) {
        const depth = r + (side === 0 ? 0.014 : 0);
        points.push(
          Math.sin(angle) * depth + Math.cos(angle) * w * side,
          y + (side === 0 ? 0.008 : 0),
          Math.cos(angle) * depth - Math.sin(angle) * w * side,
        );
      }
    for (let j = 0; j < rows.length - 1; j++)
      for (let k = 0; k < 2; k++) {
        const i = j * 3 + k;
        indices.push(i, i + 3, i + 1, i + 1, i + 3, i + 4);
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(points, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const strip = new T.Mesh(geo, peelSkin);
    root.add(strip);
    const lining = new T.Mesh(geo, peelInside);
    lining.scale.set(0.97, 1, 0.97);
    lining.position.y = 0.005;
    root.add(lining);
  }
  return root;
}

export function hammerPose(model, world, elapsed, hand, offset) {
  const impact = hammerSwing.contact,
    duration = hammerSwing.duration;
  // A short lift, a faster downward arc, and a slower return to the resting grip.
  const smooth = (x) => x * x * (3 - 2 * x);
  let angle = -0.3,
    lift = 0;
  if (elapsed >= 0) {
    if (elapsed < 0.14) {
      const t = smooth(elapsed / 0.14);
      angle += 1.22 * t;
      lift = 0.2 * t;
    } else if (elapsed <= impact) {
      const t = smooth((elapsed - 0.14) / (impact - 0.14));
      angle = 0.92 - 2.56 * t;
      lift = 0.2 - 0.32 * t;
    } else {
      const t = smooth(Math.min(1, (elapsed - impact) / (duration - impact)));
      angle = -1.64 + 1.34 * t;
      lift = -0.12 * (1 - t);
    }
  }
  const person = world.person;
  if (!world.characters.shoulderPosition(hand))
    hand.copy(person.position).y += 1.38;
  offset
    .set(0.09, -0.24 + lift, -0.3 + angle * 0.115)
    .applyQuaternion(person.quaternion);
  hand.add(offset);
  world.characters.reachRight(hand);
  world.characters.handPosition(hand);
  model.position.copy(hand);
  model.quaternion.copy(person.quaternion);
  model.rotateX(angle);
  model.rotateZ(-0.2);
}
