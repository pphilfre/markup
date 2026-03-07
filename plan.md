What is it?
Using non-null assertions cancels out the benefits of strict null-checking, and introduces the possibility of runtime errors. Avoid non-null assertions unless absolutely necessary. If you still need to use one, write a skipcq comment to explain why it is safe.

Ideally, you want to have a validation function that confirms a value isn't null, with a return type like this:

type AccentedColor = `${Color}-${Accent}`
function isColorValid(name: string): name is AccentedColor {
  // ...
}
Bad Practice
// a user named "injuly" may not exist in the DB
const injuly: User | null = db.getUserByName("injuly");

// Using the non-null assertion operator will bypass null-checking
const pfp = injuly!.profilePicture;
Recommended
const injuly: User | null = db.getUserByName("injuly");
const pfp = injuly?.profilePicture; // pfp: Image | undefined

// OR:

const pfp_ = injuly ? injuly.pfp : defaultPfp; // pfp: Image
Alternatively:

function isUserValid(userObj: User | null | undefined ): userObj is User {
  return Boolean(userObj) && validate(userObj);
}

const injuly = db.getUserByName("injuly")
if (isUserValid(injuly)) {
  const pfp = injuly.profilePicture;
  // ...
}


Description
Explicit types where they can be easily inferred may add unnecessary verbosity for variables or parameters initialized to a number, string, or boolean

Bad Practice
const a: bigint = 10n;
const a: bigint = -10n;
const a: bigint = BigInt(10);
const a: bigint = -BigInt(10);
const a: boolean = false;
const a: boolean = true;
const a: boolean = Boolean(null);
const a: boolean = !0;
const a: number = -10;
const a: number = Number('1');
const a: number = +Number('1');
const a: number = -Number('1');
const a: null = null;
const a: RegExp = /a/;
const a: RegExp = RegExp('a');
const a: RegExp = new RegExp('a');
const a: string = 'str';
const a: string = String(1);
const a: symbol = Symbol('a');
const a: undefined = void someValue;

class Foo {
  prop: number = 5;
}

function fn(a: number = 5, b: boolean = true) {}
Recommended
const a = 10n;
const a = -10n;
const a = BigInt(10);
const a = -BigInt(10);
const a = false;
const a = true;
const a = Boolean(null);
const a = !0;
const a = 10;
const a = +10;
const a = -Number('1');
const a = null;
const a = /a/;
const a = RegExp('a');
const a = 'str';
const a = String(1);
const a = Symbol('a');
const a = void someValue;

class Foo {
  prop = 5;
}

function fn(a = 5, b = true) {}

function fn(a: number, b: boolean, c: string) {}

All occurances:
Forbidden non-null assertion
Major
JS-0339
        canvas.style.height = h + "px";
      }

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
src/components/shell/whiteboard.tsx

Ignore
Forbidden non-null assertion
Major
JS-0339
    const offscreen = document.createElement("canvas");
    offscreen.width = w * 2;
    offscreen.height = h * 2;
    const ctx = offscreen.getContext("2d")!;
    ctx.scale(2, 2);

    // Background
src/components/shell/whiteboard.tsx

Ignore
Forbidden non-null assertion
Major
JS-0339
          if (!hit.selected) {
            pushUndo();
            setElements((prev) =>
              prev.map((el) => ({ ...el, selected: el.id === hit!.id }))
            );
          }
          dragOffsetRef.current = { x: cp.x - hit.x, y: cp.y - hit.y };
src/components/shell/whiteboard.tsx

Ignore
Forbidden non-null assertion
Major
JS-0339
        canvas.style.height = h + "px";
      }

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
src/components/shell/mindmap.tsx

Ignore
Forbidden non-null assertion
Major
JS-0339
    const offscreen = document.createElement("canvas");
    offscreen.width = w * 2;
    offscreen.height = h * 2;
    const ctx = offscreen.getContext("2d")!;
    ctx.scale(2, 2);

    if (settings.backgroundColor !== "transparent") {
src/components/shell/mindmap.tsx

Forbidden non-null assertion
Major
JS-0339
    // Also duplicate connections between selected nodes
    const dupedConns = connections
      .filter((c) => idMap.has(c.fromId) && idMap.has(c.toId))
      .map((c) => ({ ...c, id: crypto.randomUUID(), fromId: idMap.get(c.fromId)!, toId: idMap.get(c.toId)! }));
    setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...duped]);
    setConnections((prev) => [...prev, ...dupedConns]);
  }, [nodes, connections, pushUndo]);
src/components/shell/mindmap.tsx

Ignore
Forbidden non-null assertion
Major
JS-0339
    // Also duplicate connections between selected nodes
    const dupedConns = connections
      .filter((c) => idMap.has(c.fromId) && idMap.has(c.toId))
      .map((c) => ({ ...c, id: crypto.randomUUID(), fromId: idMap.get(c.fromId)!, toId: idMap.get(c.toId)! }));
    setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...duped]);
    setConnections((prev) => [...prev, ...dupedConns]);
  }, [nodes, connections, pushUndo]);
src/components/shell/mindmap.tsx

Ignore
Forbidden non-null assertion
Major
JS-0339
          gMinX = Math.min(gMinX, n.x!);
          gMinY = Math.min(gMinY, n.y!);
          gMaxX = Math.max(gMaxX, n.x!);
          gMaxY = Math.max(gMaxY, n.y!);
        });
        const pad = 40;
        ctx.beginPath();
src/components/shell/graph-view.tsx

Ignore
Forbidden non-null assertion
Major
JS-0339
        groupNodes.forEach((n) => {
          gMinX = Math.min(gMinX, n.x!);
          gMinY = Math.min(gMinY, n.y!);
          gMaxX = Math.max(gMaxX, n.x!);
          gMaxY = Math.max(gMaxY, n.y!);
        });
        const pad = 40;
src/components/shell/graph-view.tsx

Ignore
Forbidden non-null assertion
Major
JS-0339
        let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
        groupNodes.forEach((n) => {
          gMinX = Math.min(gMinX, n.x!);
          gMinY = Math.min(gMinY, n.y!);
          gMaxX = Math.max(gMaxX, n.x!);
          gMaxY = Math.max(gMaxY, n.y!);
        });
src/components/shell/graph-view.tsx

Forbidden non-null assertion
Major
JS-0339

        let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
        groupNodes.forEach((n) => {
          gMinX = Math.min(gMinX, n.x!);
          gMinY = Math.min(gMinY, n.y!);
          gMaxX = Math.max(gMaxX, n.x!);
          gMaxY = Math.max(gMaxY, n.y!);
src/components/shell/graph-view.tsx

Type number trivially inferred from a number literal, remove type annotation
Major
JS-0331
  el: WhiteboardElement,
  cx: number,
  cy: number,
  tolerance: number = 6
): boolean {
  switch (el.type) {
    case "rectangle":
src/components/shell/whiteboard.tsx

Ignore
Type number trivially inferred from a number literal, remove type annotation
Major
JS-0331
  nodes: MindmapNode[],
  cx: number,
  cy: number,
  tolerance: number = 8
): boolean {
  const from = nodes.find((n) => n.id === conn.fromId);
  const to = nodes.find((n) => n.id === conn.toId);
src/components/shell/mindmap.tsx