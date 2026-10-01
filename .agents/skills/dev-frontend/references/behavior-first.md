# Behavior-First Vertical Slice

Use this shared rule only when requested behavior is stable enough to state and a durable public seam can observe it. Exploratory visuals, generated code, and behavior without an honest executable seam may use another focused validation path with the reason recorded.

## Seam Gate

Before writing a test or check:

1. name the repository's existing public seam and the external behavior it exposes;
2. confirm that the seam can observe the requested result without reaching into private state or duplicating implementation logic;
3. select one behavior and one independent expected result from the specification, a worked example, or a known-good fixture.

Do not invent an abstraction only to make a test possible. If no honest seam exists, report the gap; a brittle internal assertion is not a substitute.

## Vertical Tracer Bullet

For one behavior at a time:

1. add one failing test or executable check through the confirmed seam;
2. run it and retain evidence that it is red for the intended missing or wrong behavior, not setup noise;
3. implement the minimum production change that makes this one behavior green;
4. rerun the focused check and applicable static gate;
5. keep externally observable behavior green while simplifying only what this slice made necessary;
6. repeat with the next behavior.

Avoid horizontal batches of imagined tests followed by a broad implementation. Mock only true external boundaries; never mock the behavior owner being verified. A passing test that was never observed red is validation evidence, not red-green evidence.
