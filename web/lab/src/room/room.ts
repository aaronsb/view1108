// Placeholder room (phase A): a floor, a back wall and one desk with the two terminals on it. Phase B replaces this
// module; the lab needs a build(ctx): Room, and the placed names "vector" and "glass" (the page zooms to them).
import * as THREE from "three";
import { EQUIPMENT } from "../equipment";
import type { BuildContext, Placed, Room } from "../types";

export function build(ctx: BuildContext): Room {
  const object = new THREE.Group(), placed: Placed[] = [];
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), new THREE.MeshStandardMaterial({ color: 0x3a3833, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  object.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.2), new THREE.MeshStandardMaterial({ color: 0x6f7468, roughness: 0.95 }));
  wall.position.set(0, 1.6, -2);
  object.add(wall);

  // place(equipment, name, position, turn about the vertical in radians)
  const place = (kind: string, name: string, at: [number, number, number], turn = 0) => {
    const equipment = EQUIPMENT[kind](ctx);
    equipment.object.position.set(...at);
    equipment.object.rotation.y = turn;
    equipment.object.userData.placed = name;
    object.add(equipment.object);
    placed.push({ name, equipment });
    return equipment;
  };
  const desk = place("desk", "desk", [0, 0, -1.3]);
  const top = (desk.anchors.top as THREE.Vector3).y;
  place("vector-terminal", "vector", [-0.55, top, -1.4], 0.12);
  place("glass-terminal", "glass", [0.6, top, -1.4], -0.12);

  return {
    object,
    placed,
    overview: { position: new THREE.Vector3(0, 1.6, 1.6), target: new THREE.Vector3(0, 0.95, -1.3), fov: 50 },
  };
}
