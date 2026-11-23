"""A small example to preview. The file browser never executes scripts."""
from pathlib import Path


def list_notes(folder: Path) -> list[str]:
    # Find the Markdown documents in a folder.
    return sorted(path.name for path in folder.glob('*.md'))


if __name__ == '__main__':
    for name in list_notes(Path.cwd()):
        print(f'Note: {name}')
