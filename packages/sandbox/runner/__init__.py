from .naked import Result
from .naked import run as naked_run
from .jail import run as jail_run

# Default "run" stays naked so Stage 0 behavior is unchanged for existing callers.
# Tests parametrize explicitly over both.
run = naked_run

__all__ = ["Result", "run", "naked_run", "jail_run"]
