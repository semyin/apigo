package appdata

import (
	"io"
	"os"
	"path/filepath"
)

const (
	AppName          = "api-studio"
	LegacyAppName    = "apigo"
	DBFileName       = "api-studio.db"
	LegacyDBFileName = "apigo.db"
)

func Dir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	dir := filepath.Join(base, AppName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}

	return dir, nil
}

func DBPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	dir := filepath.Join(base, AppName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}

	newPath := filepath.Join(dir, DBFileName)
	if _, err := os.Stat(newPath); err == nil {
		return newPath, nil
	}

	// Best-effort migration from legacy location.
	legacyPath := filepath.Join(base, LegacyAppName, LegacyDBFileName)
	if _, err := os.Stat(legacyPath); err == nil {
		if err := os.Rename(legacyPath, newPath); err == nil {
			return newPath, nil
		}
		// If rename fails (e.g. cross-device), copy then delete.
		if err := copyFile(legacyPath, newPath); err == nil {
			_ = os.Remove(legacyPath)
			return newPath, nil
		}
	}

	return newPath, nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer func() {
		_ = out.Close()
	}()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}
