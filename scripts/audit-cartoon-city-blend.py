#!/usr/bin/env python3
"""Export a reproducible inventory of the official Cartoon City Free demo.

Run this script through Blender, never in production:

  blender --background --python webaverse/scripts/audit-cartoon-city-blend.py -- \
    --source activity3d/assets-source/cartoon-city-free/v1.0/Cartoon_City_Free.blend \
    --report activity3d/assets-source/cartoon-city-free/v1.0/demo-city-audit.json

The script opens the supplied file without saving it and writes only a JSON
report. It deliberately does not export or publish a model: an operator must
first review the official licence and the report before selecting sectors.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

import bpy


def parse_args() -> argparse.Namespace:
    marker = "--"
    arguments = sys.argv[sys.argv.index(marker) + 1 :] if marker in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=pathlib.Path)
    parser.add_argument("--report", required=True, type=pathlib.Path)
    return parser.parse_args(arguments)


def world_bounds(obj: bpy.types.Object) -> tuple[list[float], list[float]]:
    points = [obj.matrix_world @ corner for corner in obj.bound_box]
    return (
        [min(point[index] for point in points) for index in range(3)],
        [max(point[index] for point in points) for index in range(3)],
    )


def main() -> int:
    args = parse_args()
    source = args.source.resolve()
    report = args.report.resolve()
    if not source.is_file():
        raise SystemExit(f"Official Blender source was not found: {source}")
    if source.suffix.lower() != ".blend":
        raise SystemExit("The audit source must be the official .blend demo file.")

    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    scenes = []
    for scene in bpy.data.scenes:
        mesh_objects = [obj for obj in scene.objects if obj.type == "MESH"]
        objects = []
        for obj in sorted(mesh_objects, key=lambda item: item.name.casefold()):
            minimum, maximum = world_bounds(obj)
            triangles = sum(len(polygon.vertices) - 2 for polygon in obj.data.polygons)
            objects.append(
                {
                    "name": obj.name,
                    "collection": obj.users_collection[0].name if obj.users_collection else None,
                    "triangles": triangles,
                    "materials": [slot.material.name if slot.material else None for slot in obj.material_slots],
                    "bounds": {"min": minimum, "max": maximum},
                    "location": list(obj.location),
                }
            )
        scenes.append(
            {
                "name": scene.name,
                "meshCount": len(objects),
                "triangleCount": sum(item["triangles"] for item in objects),
                "objects": objects,
            }
        )

    payload = {
        "schemaVersion": 1,
        "source": str(source),
        "scenes": scenes,
        "materials": sorted(material.name for material in bpy.data.materials),
        "images": sorted(image.name for image in bpy.data.images),
    }
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
