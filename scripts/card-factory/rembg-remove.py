import sys
from pathlib import Path

from rembg import remove


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: rembg-remove.py <input> <output>", file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with input_path.open("rb") as source_file:
        input_bytes = source_file.read()

    output_bytes = remove(input_bytes)

    with output_path.open("wb") as output_file:
        output_file.write(output_bytes)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
