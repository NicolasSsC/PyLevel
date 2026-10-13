import subprocess
import unittest
from execute import execute, validate


class SandboxTests(unittest.TestCase):
    def run_code(self, code):
        return execute({'files': {'main.py': code}})

    def test_multiple_files(self):
        result = execute({'files': {'main.py': 'from lib import value\nprint(value)',
                                    'lib.py': 'value = 42'}})
        self.assertEqual(result['exit_code'], 0, result)
        self.assertEqual(result['output'], '42\n')

    def test_restrictions(self):
        result = self.run_code('''import os, socket
assert os.getuid() == 65534
try:
    open('/opt/forbidden', 'w')
except OSError:
    pass
else:
    raise AssertionError('root filesystem writable')
try:
    socket.create_connection(('1.1.1.1', 443), timeout=1)
except OSError:
    pass
else:
    raise AssertionError('external network reachable')
print('restricted')
''')
        self.assertEqual(result['exit_code'], 0, result)
        self.assertIn('restricted', result['output'])

    def test_timeout(self):
        self.assertEqual(self.run_code('while True: pass')['status'], 'timeout')

    def test_output_limit(self):
        result = self.run_code("while True: print('x' * 4096)")
        self.assertEqual(result['status'], 'output_limit')
        self.assertLessEqual(len(result['output']), 65536)

    def test_public_tests(self):
        result = execute({'action': 'test', 'files': {
            'tests/test_example.py': 'import unittest\nclass T(unittest.TestCase):\n def test_sum(self): self.assertEqual(2 + 2, 4)'}})
        self.assertEqual(result['exit_code'], 0, result)
        self.assertIn('Ran 1 test', result['output'])

    def test_invalid_path(self):
        with self.assertRaises(ValueError):
            validate({'files': {'../escape.py': ''}})


if __name__ == '__main__':
    unittest.main()
