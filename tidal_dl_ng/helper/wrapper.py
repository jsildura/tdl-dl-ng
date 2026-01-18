import traceback
from collections.abc import Callable


class LoggerWrapped:
    """Wrapper for logging functionality with optional debug tracebacks.

    Attributes:
        fn_print: The function to use for printing messages.
        debug_mode: Whether to enable debug mode with full tracebacks.
    """

    def __init__(self, fn_print: Callable, debug: bool = False):
        """Initialize the logger wrapper.

        Args:
            fn_print (Callable): The function to use for printing messages.
            debug (bool, optional): Enable debug mode with full tracebacks. Defaults to False.
        """
        self.fn_print: Callable = fn_print
        self.debug_mode: bool = debug

    def debug(self, value):
        self.fn_print(value)

    def warning(self, value):
        self.fn_print(value)

    def info(self, value):
        self.fn_print(value)

    def error(self, value):
        self.fn_print(value)

    def critical(self, value):
        self.fn_print(value)

    def exception(self, value):
        """Log an exception with traceback.

        Args:
            value: The message to log along with the exception traceback.
        """
        self.fn_print(value)
        # Print the full exception traceback only if debug mode is enabled
        if self.debug_mode:
            tb = traceback.format_exc()
            if tb and tb.strip() != "NoneType: None":
                self.fn_print(tb)
