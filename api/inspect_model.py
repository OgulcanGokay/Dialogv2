import joblib

MODEL_PATH = "models/ridge_pipe_global_delta_scaled.joblib"

m = joblib.load(MODEL_PATH)
print("MODEL TYPE:", type(m))
print("MODEL:", m)

# Pipeline ise:
try:
    print("Pipeline steps:", m.named_steps.keys())
except Exception:
    pass

# ColumnTransformer varsa:
try:
    pre = m.named_steps["preprocess"]
    print("Preprocess:", pre)
    try:
        names = pre.get_feature_names_out()
        print("Feature names out (len):", len(names))
        for i, n in enumerate(names):
            print(i, n)
    except Exception as e:
        print("get_feature_names_out failed:", e)
except Exception as e:
    print("No preprocess step or not a pipeline:", e)

# Modelin ham input kolonları (feature_names_in_) varsa:
try:
    print("feature_names_in_ (len):", len(m.feature_names_in_))
    print(m.feature_names_in_)
except Exception as e:
    print("feature_names_in_ not available:", e)
