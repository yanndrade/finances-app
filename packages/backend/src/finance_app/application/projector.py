from typing import Protocol


class ProjectionRunner(Protocol):
    def run(self) -> int: ...
    def rebuild(self) -> int: ...


class ProjectEventsUseCase:
    def __init__(self, projector: ProjectionRunner) -> None:
        self._projector = projector

    def execute(self) -> int:
        return self._projector.run()


class RebuildProjectionsUseCase:
    def __init__(self, projector: ProjectionRunner) -> None:
        self._projector = projector

    def execute(self) -> int:
        return self._projector.rebuild()
