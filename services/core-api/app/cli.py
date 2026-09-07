import argparse
import os
import sys


def run_expression(expr: str):
    if os.getenv("HELIOS_DEV_CLI") != "1":
        sys.exit(1)
    return eval(expr)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("expr")
    args = parser.parse_args()
    print(run_expression(args.expr))


if __name__ == "__main__":
    main()
