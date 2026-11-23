"""A tiny program to demonstrate in TakeLab's terminal."""


def greeting(name: str) -> str:
    return f"Hello, {name}! Ready for the next take?"


if __name__ == "__main__":
    print(greeting("TakeLab"))
    for step, action in enumerate(("Read your script", "Show your work", "Record your take"), 1):
        print(f"  {step}. {action}")
