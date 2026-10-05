"""publish.py - push the site source to GitHub; GitHub Actions builds and deploys it (live in ~1-2 minutes).

    python publish.py                 pull any edits made in the admin screen, build locally as a check, commit, push
    python publish.py "message"       same, with your own commit message
    python publish.py --preview       build only and open a local preview (nothing is published)
    python publish.py --status        show what would be published

How the repo works
    The project folder (content/, site/, .pages.yml, .github/) IS the public repo lewbimsm-rgb/lewbimsm-rgb.github.io,
    but its git metadata lives outside the folder (GIT_DIR below) so the private hub repo still backs up everything,
    including the folders the public repo excludes (tools/, _secrets/, backups/, research/, plans).
    Excludes are in <GIT_DIR>/info/exclude, not in a .gitignore, for the same reason.
    Edits made in the admin screen (Pages CMS) land in GitHub first; this script pulls them before pushing.
"""
import os, sys, subprocess, datetime, webbrowser
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.normpath(os.path.join(HERE, ".."))
GIT_DIR = os.path.normpath(os.path.join(PROJECT, "..", "..", ".git-smartselectlabs"))
DOCS = os.path.join(HERE, "docs")
GIT = ["git", "--git-dir=" + GIT_DIR, "--work-tree=" + PROJECT, "-c", "user.name=Lewis Kim", "-c", "user.email=lewbimsm@gmail.com", "-c", "core.safecrlf=false"]


def run(cmd, check=True):
    r = subprocess.run(cmd, cwd=PROJECT, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(r.stdout[-800:], r.stderr[-800:]); sys.exit("failed: " + " ".join(cmd[:3]) + " ...")
    return r.stdout.strip()


def main():
    if "--preview" in sys.argv:
        print(run([sys.executable, os.path.join(HERE, "build.py")]))
        webbrowser.open("file:///" + os.path.join(DOCS, "index.html").replace("\\", "/")); print("preview opened (not published)"); return
    if not os.path.isdir(GIT_DIR):
        sys.exit("git metadata not found at %s (see README: one-time setup)" % GIT_DIR)
    print(run(GIT + ["pull", "-q", "--rebase", "--autostash", "origin", "main"], check=False) or "pulled")
    if "--status" in sys.argv:
        print(run(GIT + ["status", "--short"]) or "nothing to publish"); return
    print(run([sys.executable, os.path.join(HERE, "build.py")]))   # local sanity build; GitHub does the real one
    run(GIT + ["add", "-A"])
    if not run(GIT + ["status", "--porcelain"]):
        print("nothing changed since the last publish"); return
    msg = next((a for a in sys.argv[1:] if not a.startswith("--")), "Publish " + datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))
    run(GIT + ["commit", "-q", "-m", msg])
    run(GIT + ["push", "-q", "origin", "main"])
    print("pushed:", msg)
    print("GitHub is building; live at https://smartselectlabs.com in about 1-2 minutes.")
    print("progress: https://github.com/lewbimsm-rgb/lewbimsm-rgb.github.io/actions")


if __name__ == "__main__":
    main()
