import glob


def is_regex_prev(text, i):
    j = i - 1
    while j >= 0 and text[j] in " \t\n\r":
        j -= 1
    if j < 0:
        return True
    return text[j] in "([{=:;!&|?,+-*%>~"


def strip_code(text):
    out = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            i += 2
            while i < n and text[i] != "\n":
                i += 1
        elif c == "/" and i + 1 < n and text[i + 1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
        elif c == "/" and is_regex_prev(text, i):
            i += 1
            inclass = False
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "[":
                    inclass = True
                    i += 1
                    continue
                if text[i] == "]":
                    inclass = False
                    i += 1
                    continue
                if text[i] == "/" and not inclass:
                    i += 1
                    break
                if text[i] == "\n":
                    break
                i += 1
        elif c == "'" or c == '"':
            q = c
            i += 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == q:
                    i += 1
                    break
                i += 1
        elif c == "`":
            i += 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == "`":
                    i += 1
                    break
                i += 1
        else:
            if c in "{}()[]":
                out.append(c)
            i += 1
    return out


def validate(toks):
    stack = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for t in toks:
        if t in "([{":
            stack.append(t)
        else:
            if not stack or stack[-1] != pairs[t]:
                return False, stack
            stack.pop()
    return (not stack), stack


def main_program():
    err = 0
    for path in [*glob.glob("src/**/*.jsx", recursive=True), *glob.glob("src/**/*.js", recursive=True)]:
        toks = strip_code(open(path, encoding="utf-8").read())
        ok, stack = main_program_check(toks)
        if not ok:
            err += 1
            print(f"FAIL {path}: leftover={stack}")
        else:
            print(f"OK   {path}")
    print("RESULT:", "ALL PASS" if err == 0 else f"{err} FAILURES")


def main_program_check(toks):
    stack = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for t in toks:
        if t in "([{":
            stack.append(t)
        else:
            if not stack or stack[-1] != pairs[t]:
                return False, stack
            stack.pop()
    return (not stack), stack


if __name__ == "__main__":
    main_program()